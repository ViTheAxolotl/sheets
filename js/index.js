/**
 * index.js — the Sheets home page (index.html).
 *
 *   • Lists the account's character sheets and any sheets shared with it; click one to open it.
 *   • + creates a new sheet; the trash icon switches to delete mode.
 *   • Opening a sheet loads stats.html?<Character>-<Owner> in an iframe, with the character's
 *     portrait (uploadable), sheet zoom buttons, and a dice roller.
 *   • Opening index.html?<Owner>-<Character> (a Share link) adds that sheet to this
 *     account's Shared Sheets and opens it.
 *
 * Dice roller: Basic (XdY+Z), Checks / Saves (d20 + a stat from the open sheet), and Preset:
 * saved rolls made of an accuracy bonus plus one or more damage rows. Stat names wrapped in $
 * ($Strength$, $proficiency$) are swapped for the open sheet's values when rolled.
 * rollPreset is also put on `window` so stats.html can call it for right-click rolls.
 */

"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, reload, deleteDoc, handleImageUpload, clenseInput, popupAlert, popupConfirm } from './viMethods.js';

let player;
let wholeChar = {};
let firstRun = true;
let sheets;
let charName;
let wholeStat;
let playerName, name;
let htmlInfo = window.location.href;
let wholeRolls = {};
let rollDiceBtn;

fetch('src/rolls.json').then(res => res.json()).then((json) => wholeRolls = json);


// Everything starts once account data arrives. Later updates only re-apply the zoom
// and rebuild the sheet list.
const charRef = ref(database, 'playerChar/');
let dataArrived = false;
onValue(charRef, (snapshot) => 
{
    wholeChar = snapshot.val() ?? {};
    dataArrived = true;
    applyData();
});

// Runs once both the login and the data are known (they can arrive in either order)
function applyData()
{
    if(!player || !dataArrived){return;}

    if(firstRun)
    {
        firstRun = false;
        init();
    }

    else
    {
        if(wholeChar[player]?.["zoomSheetLevel"] && document.getElementById("statSheet"))
        {
            applySheetZoom(wholeChar[player]["zoomSheetLevel"]);
        }
    }

    loadSheets();
}

// Not logged in -> go to the login page, which sends them back here afterwards.
onAuthStateChanged(auth, (user) => 
{
    if (!user) 
    {
        popupAlert("You need to log in to use Sheets. Press Done to go to the login page.", "Log in").then(() => {window.location.href = `loginPage.html?|${htmlInfo}`;});
    } 

    else
    {
        player = auth.currentUser.email.split("@");
        player = toTitleCase(player[0]);
        applyData();
    }
});

/**
 * Rebuilds the list of the account's sheets and shared sheets, and shows the trash icon.
 */
function loadSheets()
{
    document.getElementById("sheets").innerHTML = "";

    generateSheets("sheets", "sharedSheets", "load");

    let deleteBtn = document.getElementById("trashcan");
    deleteBtn.src = "images/trashIcon.png";
    deleteBtn.style.display = "block";
    deleteBtn.style.margin = "10px auto";
    deleteBtn.onclick = handleDeleteBtn;
}

/**
 * Switches the dice roller between Basic (three number boxes), Checks / Saves (a stat
 * dropdown with its bonus) and Preset (the saved roll presets).
 */
function handleDiceSelect()
{
    let selects = document.getElementsByClassName("diceSelect");
    let display = document.getElementById("diceRoller");

    for(let select of selects){select.classList = "gridButton diceSelect";}
    this.classList = "gridButton diceSelect selected-dice";

    display.innerHTML = "";

    switch(this.innerHTML)
    {
        case "Basic":
            let numOfDice = document.createElement("input");
            numOfDice.id = "diceToRoll"; numOfDice.placeholder = "1"; display.appendChild(numOfDice);
            display.innerHTML += '<p>d</p>';
            
            let sides = document.createElement("input");
            sides.id = "sides"; sides.placeholder = "20"; display.appendChild(sides);
            display.innerHTML += '<p>+/-</p>';
            
            let modifier = document.createElement("input");
            modifier.id = "modifier"; modifier.placeholder = "0"; display.appendChild(modifier);
            
            for(let elm of display.childNodes){elm.style.display = "inline"; elm.style.margin = "5px"; if(elm.placeholder != ""){elm.value = elm.placeholder;}}
            break;
        
        case "Checks":
        case "Saves":
        case "Misc":
            let select = document.createElement("select");
            select.id = "statChoice";
            select.innerHTML = `<option value="none">${this.innerHTML}</option>`;
            select.onchange = updateStat;
            select.style.margin = "10px";
            select.style.display = "inline";

            for(let roll of wholeRolls["rolls"][this.innerHTML])
            {
                select.innerHTML += `<option value="${roll}">${toTitleCase(roll)}</option>`;
            }

            let mod = document.createElement("h6");
            mod.id = "diceMod";
            mod.style.display = "inline";
            mod.innerHTML = "+0";
            mod.style.margin = "10px";

            display.appendChild(select);
            display.appendChild(mod);
            break;

        case "Preset":
            if(!wholeChar[player][charName]["presets"])
            {
                setDoc(`playerChar/${player}/${charName}/presets`, {"hold":"hold"});
            }

            renderPresetsMenu(display);

            break;
    }
}

/**
 * Lists the open character's roll presets, each with Roll, Edit and Delete icons, plus
 * a Create New Preset button.
 */
function renderPresetsMenu(display)
{
    display.innerHTML = "<h3>Custom Roll Presets</h3>";

    let listWrapper = document.createElement("div");
    listWrapper.id = "presetsList";
    listWrapper.style.margin = "15px 0";
    display.appendChild(listWrapper);

    let presets = wholeChar[player][charName]["presets"];
    
    if(presets.length == 1)
    {
        let message = document.createElement("p");
        message.innerHTML = "No presets found, Create one below.";
        listWrapper.appendChild(message);
    }

    else
    {
        Object.keys(presets).forEach(presetKey => 
        {
            if(presetKey != "hold")
            {
                let presetData = presets[presetKey];

                let presetRow = document.createElement("div");
                presetRow.className = "preset-view-row";
                presetRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 8px 15px; margin: 5px 0; border-radius: 4px;";

                let nameSpan = document.createElement("span");
                nameSpan.innerHTML = presetData.name;
                nameSpan.style.cssText = "font-weight: bold; flex-grow: 1; text-align: left;";
                presetRow.appendChild(nameSpan);

                let iconControls = document.createElement("div");
                iconControls.style.cssText = "display: flex; gap: 15px;";

                let rollBtn = document.createElement("img");
                rollBtn.src = "../images/diceIcon.png";
                rollBtn.style.cursor = "pointer";
                rollBtn.title = "Roll Preset";
                rollBtn.onclick = () => rollPreset(presetData);
                iconControls.appendChild(rollBtn);

                let editBtn = document.createElement("img");
                editBtn.src = "../images/editIcon.png";
                editBtn.style.cursor = "pointer";
                editBtn.title = "Edit Preset";
                editBtn.onclick = () => createPreset(display, presetKey, presetData);
                iconControls.appendChild(editBtn);

                let deleteBtn = document.createElement("img");
                deleteBtn.src = "../images/trashIcon.png";
                deleteBtn.style.cursor = "pointer";
                deleteBtn.title = "Delete Preset";
                deleteBtn.onclick = () => deletePreset(display, presetKey);
                iconControls.appendChild(deleteBtn);

                presetRow.appendChild(iconControls);
                listWrapper.appendChild(presetRow);
            } 
        });
    }

    let createNew = document.createElement("button");
    createNew.classList = "gridButton";
    createNew.innerHTML = "Create New Preset";
    createNew.onclick = () => createPreset(display);
    display.appendChild(createNew);
}

/**
 * Shows the preset form: a title, an accuracy bonus (or "skip" for save-based spells), and
 * one or more damage rows. Pre-filled when editing an existing preset.
 */
function createPreset(display, existingKey = null, data = null)
{
    display.innerHTML = `<h3>${existingKey ? 'Edit' : 'Create'} Preset</h3>`;

    let form = document.createElement("div");
    form.id = "presetFormContainer";
    form.style.cssText = "text-align: left; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-top: 10px;";

    const titleLabel = document.createElement("label");
    titleLabel.innerHTML = "Preset Name:";
    titleLabel.style.cssText = "display: block; color: white; margin-bottom: 4px;";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.id = "presetTitleField";
    titleInput.value = data ? data.name : "";
    titleInput.style.cssText = "width: 100%; margin-bottom: 15px; padding: 6px; background: #222; color: white; border: 1px solid #444;";
    form.appendChild(titleLabel);
    form.appendChild(titleInput);

    // --- ACCURACY BLOCK WITH SKIP OPTION ---
    const accContainer = document.createElement("div");
    accContainer.style.marginBottom = "15px";

    // Create the "Skip" Checkbox Row
    const skipLabel = document.createElement("label");
    skipLabel.style.cssText = "display: block; color: #aaa; margin-bottom: 6px; font-size: 13px; cursor: pointer;";
    
    const skipCheck = document.createElement("input");
    skipCheck.type = "checkbox";
    skipCheck.id = "presetSkipAccuracyCheck";
    skipCheck.style.marginRight = "8px";
    
    skipLabel.appendChild(skipCheck);
    skipLabel.appendChild(document.createTextNode("Skip Accuracy (Save Spell / Dynamic Effect)"));
    accContainer.appendChild(skipLabel);

    const accLabel = document.createElement("label");
    accLabel.innerHTML = "Accuracy Modifier (1d20 + X):";
    accLabel.style.cssText = "display: block; color: white; margin-bottom: 4px;";
    
    const accInput = document.createElement("input");
    accInput.type = "text";
    accInput.id = "presetAccuracyField";
    accInput.placeholder = "Use a number +/-, or use $Strength$ or $proficiency$ to get a stat. It understands basic math.";
    accInput.style.cssText = "width: 100%; padding: 6px; background: #222; color: white; border: 1px solid #444;";
    
    // Hydrate existing data state checks
    if (data && data.accuracyBonus === "save") 
    {
        skipCheck.checked = true;
        accInput.disabled = true;
        accInput.style.opacity = "0.4";
        accInput.value = "";
    } 
    
    else 
    {
        accInput.value = data ? data.accuracyBonus : "";
        accInput.disabled = false;
        accInput.style.opacity = "1";
    }

    // Toggle behavior when box is checked/unchecked
    skipCheck.onchange = function() 
    {
        if (this.checked) {
            accInput.disabled = true;
            accInput.style.opacity = "0.4";
            accInput.value = "";
        } 
        
        else 
        {
            accInput.disabled = false;
            accInput.style.opacity = "1";
            accInput.placeholder = "Use a number +/-, or use $Strength$ or $proficiency$ to get a stat. It understands basic math.";
        }
    };

    accContainer.appendChild(accLabel);
    accContainer.appendChild(accInput);
    form.appendChild(accContainer);

    const matrixLabel = document.createElement("label");
    matrixLabel.innerHTML = "Damage Dice Rolls:";
    matrixLabel.style.cssText = "display: block; color: #ffca28; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #555; padding-bottom: 4px;";
    form.appendChild(matrixLabel);

    const rowsContainer = document.createElement("div");
    rowsContainer.id = "presetDiceRowsContainer";
    form.appendChild(rowsContainer);

    // Multi-Row Addition Call Controller
    const addRowBtn = document.createElement("button");
    addRowBtn.type = "button";
    addRowBtn.className = "gridButton";
    addRowBtn.innerHTML = "➕ Add Another Dice Roll";
    addRowBtn.style.cssText = "margin: 10px 0; width: auto;";
    addRowBtn.onclick = () => appendDiceRow(rowsContainer);
    form.appendChild(addRowBtn);

    // Footer Control Block Elements
    const footerControls = document.createElement("div");
    footerControls.style.cssText = "display: flex; gap: 10px; margin-top: 15px;";

    const saveBtn = document.createElement("button");
    saveBtn.className = "gridButton";
    saveBtn.innerHTML = "Save Preset";
    saveBtn.onclick = () => savePreset(display, existingKey);
    
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "gridButton";
    cancelBtn.innerHTML = "Cancel";
    cancelBtn.onclick = function(){display.innerHTML = ""; renderPresetsMenu(display);};

    footerControls.appendChild(saveBtn);
    footerControls.appendChild(cancelBtn);
    form.appendChild(footerControls);

    display.appendChild(form);

    if (data && data.rolls) 
    {
        data.rolls.forEach(rollInstance => appendDiceRow(rowsContainer, rollInstance));
    } 
    
    else 
    {
        appendDiceRow(rowsContainer);
    }
}

/**
 * Adds one damage row to the preset form: how many dice, die size, modifier and damage
 * type, with an × to remove the row.
 */
function appendDiceRow(parentWrapper, existingRollData = null) 
{
    const rowWrapper = document.createElement("div");
    rowWrapper.className = "dice-input-matrix-row";
    rowWrapper.style.cssText = "display: flex; gap: 6px; align-items: center; margin-bottom: 8px; background: rgba(0,0,0,0.15); padding: 6px; border-radius: 4px;";

    const qtyInput = document.createElement("input");
    qtyInput.className = "row-qty";
    qtyInput.placeholder = "Qty";
    qtyInput.min = "1";
    qtyInput.value = existingRollData ? existingRollData.qty : "1";
    qtyInput.style.cssText = "width: 15%; padding: 4px; background: #222; color: white; border: 1px solid #444; text-align: center;";

    // Dice Face Selector Box
    const diceSelect = document.createElement("select");
    diceSelect.className = "row-dice-type";
    const values = ["4", "6", "8", "10", "12", "20", "100"];
    values.forEach(val => 
    {
        const opt = document.createElement("option");
        opt.value = `d${val}`;
        opt.innerHTML = `d${val}`;
        diceSelect.appendChild(opt);
    });
    diceSelect.value = existingRollData ? existingRollData.type : "d6";
    diceSelect.style.cssText = "width: 20%; padding: 4px; background: #222; color: white; border: 1px solid #444;";

    const modInput = document.createElement("input");
    modInput.className = "row-mod";
    modInput.placeholder = "Use a number +/-, or use $Strength$ to get a stat. It understands basic math.";
    modInput.value = existingRollData ? existingRollData.modifier : "+0";
    modInput.style.cssText = "width: 20%; padding: 4px; background: #222; color: white; border: 1px solid #444; text-align: center;";

    // Damage Element Select List Box
    const dmgSelect = document.createElement("select");
    dmgSelect.className = "row-dmg-type";
    const elementalCategories = 
    [
        "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", 
        "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"
    ];
    elementalCategories.forEach(type => 
    {
        const opt = document.createElement("option");
        opt.value = type;
        opt.innerHTML = type;
        dmgSelect.appendChild(opt);
    });
    dmgSelect.value = existingRollData ? existingRollData.damageType : "Bludgeoning";
    dmgSelect.style.cssText = "width: 35%; padding: 4px; background: #222; color: white; border: 1px solid #444;";

    // Inline Sub-Delete Tracker Button
    const deleteRowItem = document.createElement("span");
    deleteRowItem.innerHTML = "❌";
    deleteRowItem.style.cssText = "cursor: pointer; font-size: 12px; padding: 0 4px;";
    deleteRowItem.onclick = () => 
    {
        if (parentWrapper.children.length > 1) 
        {
            rowWrapper.remove();
        } 
        
        else 
        {
            popupAlert("A preset needs at least one dice row.");
        }
    };

    rowWrapper.appendChild(qtyInput);
    rowWrapper.appendChild(diceSelect);
    rowWrapper.appendChild(modInput);
    rowWrapper.appendChild(dmgSelect);
    rowWrapper.appendChild(deleteRowItem);

    parentWrapper.appendChild(rowWrapper);
}   

/**
 * Reads the preset form (names and modifiers are cleaned) and saves it under the
 * character's presets, then shows the preset list again.
 */
function savePreset(display, presetName = null)
{
    let title = clenseInput(document.getElementById("presetTitleField").value.trim());
    let isSkipped = document.getElementById("presetSkipAccuracyCheck").checked;
    let accuracy = isSkipped ? "save" : clenseInput(document.getElementById("presetAccuracyField").value || "+0");

    if(title == "")
    {
        popupAlert("Give the preset a title.");
        return;
    }

    const compiledRows = [];
    const UIInputMatrixRows = document.querySelectorAll(".dice-input-matrix-row");

    UIInputMatrixRows.forEach(row => {
        const qty = row.querySelector(".row-qty").value || "1";
        const type = row.querySelector(".row-dice-type").value;
        const modifier = clenseInput(row.querySelector(".row-mod").value.trim()) || "0";
        const damageType = row.querySelector(".row-dmg-type").value;

        compiledRows.push({ qty, type, modifier, damageType });
    });

    let data = 
    {
        name: title,
        accuracyBonus: accuracy,
        rolls: compiledRows
    };

    setDoc(`playerChar/${player}/${charName}/presets/${title}`, data);

    display.innerHTML = ""; 
    renderPresetsMenu(display);
}

/**
 * Asks for confirmation, deletes the preset and shows the list again.
 */
async function deletePreset(display, title)
{
    if(!await popupConfirm(`Delete the ${title} preset?`, {title: "Delete preset", yes: "Delete", no: "Keep"})){return;}
    deleteDoc(`playerChar/${player}/${charName}/presets/${title}`);

    display.innerHTML = ""; 
    renderPresetsMenu(display);
}

/**
 * Rolls a preset. Unless it's a save, rolls to hit first (with advantage/disadvantage if
 * chosen) and asks whether it hit; if it did, rolls every damage row and shows the total
 * for each damage type.
 */
async function rollPreset(data)
{
    let display = "";
    let accModifier = data.accuracyBonus;
    let hit;

    if(accModifier != "save")
    {
        accModifier = accModifier.split("$");

        if(accModifier.length > 1)
        {
            accModifier = decodeVariable(accModifier);
        }

        if(document.getElementById("adv").value != "Advantage/Disadvantage") //If needs to roll twice
        { 
            let take = parseInt(diceRoller(`${1}`, `${20}`, `${accModifier}`, "finalResult"));
            let take2 = parseInt(diceRoller(`${1}`, `${20}`, `${accModifier}`, "finalResult"));
            let usersRoll;

            switch(document.getElementById("adv").value)
            {
                case "Advantage":
                    if(take > take2){usersRoll = take;} else {usersRoll = take2;}
                    break;

                case "Disadvantage":
                    if(take < take2){usersRoll = take;} else {usersRoll = take2;}
                    break;
            }

            display = `${charName} rolled ${usersRoll} (${usersRoll-accModifier}+${accModifier}) for accuracy for their ${data.name} attack. First Roll: ${take}, Second Roll: ${take2}.\n\nDoes this hit the target?`;
            display = display.replaceAll("++", "+");
            hit = await popupConfirm(display, {title: `${data.name}: to hit`, yes: "Hit", no: "Miss"});
        }

        else // Rolls once
        {
            let accRoll = parseInt(diceRoller(`${1}`, `${20}`, `${accModifier}`, "finalResult"));

            display = `${charName} rolled ${accRoll} (${accRoll-accModifier}+${accModifier}) for accuracy for their ${data.name} attack.\n\nDoes this hit the target?`;
            display = display.replaceAll("++", "+");
            hit = await popupConfirm(display, {title: `${data.name}: to hit`, yes: "Hit", no: "Miss"});
        }

        if(!hit){return;}
    }

    display = `${charName} does `;

    for(let roll of data.rolls)
    {
        let damageType = roll["damageType"];
        let quantity = `${roll["qty"]}`;
        let modifier = `${roll["modifier"]}`;
        let type = roll["type"];

        type = type.slice(1);

        quantity = quantity.split("$");
        if(quantity.length > 1)
        {
            quantity = decodeVariable(quantity);
        }

        modifier = modifier.split("$");
        if(modifier.length > 1)
        {
            modifier = decodeVariable(modifier);
        }

        modifier = parseInt(modifier);
        let userRoll = parseInt(diceRoller(`${quantity}`, `${type}`, `${modifier}`, "finalResult"));

        display += `${userRoll} (${userRoll-modifier}+${modifier}) ${damageType} damage, `;
    }

    display += `to the target, using their ${data.name} attack.`;
    display = display.replaceAll("++", "+");
    popupAlert(display, `${data.name}: damage`);
}

window.rollPreset = rollPreset;

/**
 * Adds up a modifier written with stat names, already split on "$": numbers count as
 * themselves and names are looked up on the open sheet (e.g. "+$Strength$+2").
 */
function decodeVariable(toDecode)
{
    let total = 0;

    for(let i = 0; i < toDecode.length; i++)
    {
        let segment = toDecode[i];
        if(segment == "+" || segment == ""){continue;}

        try
        {
            if(isNaN(parseInt(segment)))
            {
                segment = parseInt(wholeChar[player][charName]["stats"][segment]);
                if(isNaN(segment)){popupAlert(`A stat name in this roll wasn't found on the sheet: ${toDecode[i]}. Check its spelling and capitals, or ask Vi for help.`, "Unknown stat"); break;}
                total += segment;
            }

            else
            {
                total += parseInt(segment);
            }
        }
        
        catch (error)
        {
            popupAlert(`A stat name in this roll wasn't found on the sheet: ${segment}. Check its spelling and capitals, or ask Vi for help.`, "Unknown stat");
        }
    }

    return total;
}

/**
 * Dice roller: a stat was chosen; show its bonus from the open sheet.
 */
function updateStat()
{
    let diceMod = document.getElementById("diceMod");
    let stat = document.getElementById("statChoice").value;
    
    if(!["deathSave", "Misc", "Saves", "Checks", "Basic"].includes(stat)){if(wholeStat){diceMod.innerHTML = `${toTitleCase(stat)}: ${wholeStat["stats"][stat]}`;} else {popupAlert("Open a character's sheet before rolling.");}}
    else{diceMod.innerHTML = `${toTitleCase(stat)}: +0`;}
}

/**
 * Adds a button for each sheet the account owns, and for each shared sheet. In delete mode
 * the buttons delete instead of open. Account-level keys (currentSheet, zoomSheetLevel,
 * shared) aren't sheets and are skipped.
 */
function generateSheets(sheetLocation, sharedLocation, mode)
{
    for(let sheet of Object.keys(wholeChar[player] ?? {})) //A new account has no sheets yet
    {
        if(["currentSheet", "zoomSheetLevel", "shared"].includes(sheet)){continue;}
        
        else if("sharedSheets" == sheet)
        {
            let sharedDiv = document.getElementById(sharedLocation);
            let h3 = document.createElement("h3");
            h3.innerHTML = "Shared Sheets";
            sharedDiv.appendChild(h3);

            for(let sharedSheet of Object.keys(wholeChar[player]["sharedSheets"]))
            {
                if(document.getElementById(sharedSheet))
                {
                    continue;
                }

                let button = document.createElement("button");
                button.innerHTML = toTitleCase(sharedSheet);
                button.id = sharedSheet; 
                button.onclick = function() {setDoc(`playerChar/${player}/shared`, false); handleShowSheet(this.title, this.innerHTML);};
                if(mode == "delete"){button.onclick = function() {deleteSheet("shared", button.innerHTML);}}
                button.classList = "gridButton";
                button.title = toTitleCase(wholeChar[player]["sharedSheets"][sharedSheet]["playerName"]);
                sharedDiv.appendChild(button);
            }
        }

        else
        {
            let button = document.createElement("button");
            button.innerHTML = sheet; 
            button.onclick = function() {setDoc(`playerChar/${player}/shared`, false); handleShowSheet(this.title, this.innerHTML);};
            if(mode == "delete"){button.onclick = function() {deleteSheet("owned", button.innerHTML);}}
            button.classList = "gridButton";
            button.title = player;
            document.getElementById(sheetLocation).appendChild(button);
        }
    }
}

/**
 * Hooks up the + button, zoom buttons and dice roller. If the address has
 * "?<Owner>-<Character>" (a Share link), saves that sheet to Shared Sheets and opens it.
 */
function init()
{
    document.getElementById("addButton").onclick = handleCreateNewSheet;
    let buttons = document.getElementsByClassName("inOrDe");
    for(let button of buttons){button.onclick = handleButton;}

    if(htmlInfo.includes("?"))
    {
        htmlInfo = htmlInfo.split("?");
        htmlInfo = htmlInfo[1];
        htmlInfo = htmlInfo.split("-");
        name = toTitleCase(htmlInfo[1].replaceAll("%20", " "));
        playerName = toTitleCase(htmlInfo[0]);

        setDoc(`playerChar/${player}/shared`, true);
        setDoc(`playerChar/${player}/sharedSheets/${name}`, {"name" : name, "playerName" : playerName});
        handleShowSheet(playerName, name);
    }

    for(let diceSelect of document.getElementsByClassName("diceSelect")){diceSelect.onclick = handleDiceSelect;}
    rollDiceBtn = document.getElementById("rollDice").onclick = handleDiceRoll;
}

/**
 * The Roll button: Basic rolls XdY+Z from the boxes; Checks / Saves roll a d20 plus the
 * chosen stat. Advantage/Disadvantage rolls twice and keeps the higher/lower.
 */
function handleDiceRoll()
{
    let modifier;

    if(document.getElementById("diceMod"))
    {
        modifier = document.getElementById("diceMod").innerHTML;
        modifier = modifier.split(": ");
    }

    switch(document.getElementsByClassName("selected-dice")[0].innerHTML)
    {
        case "Basic":
            let amount = parseInt(document.getElementById("diceToRoll").value);
            let dice = parseInt(document.getElementById("sides").value);
            modifier = parseInt(document.getElementById("modifier").value);
        
            if(!Number.isNaN(amount) && !Number.isNaN(dice) && !Number.isNaN(modifier)) //If all three values are given
            {
                if(document.getElementById("adv").value != "Advantage/Disadvantage") 
                { 
                    let take = parseInt(diceRoller(`${amount}`, `${dice}`, `${modifier}`, "finalResult"));
                    let take2 = parseInt(diceRoller(`${amount}`, `${dice}`, `${modifier}`, "finalResult"));
                    let usersRoll;

                    switch(document.getElementById("adv").value)
                    {
                        case "Advantage":
                            if(take > take2){usersRoll = take;} else {usersRoll = take2;}
                            break;

                        case "Disadvantage":
                            if(take < take2){usersRoll = take;} else {usersRoll = take2;}
                            break;
                    }

                    popupAlert(`${window.name} rolled ${amount}d${dice}+${modifier}: (${parseInt(usersRoll)-modifier})+${modifier}= ${usersRoll}. First Roll: ${take}, Second Roll: ${take2}.`, "Roll");
                }

                else{popupAlert(diceRoller(amount, dice, modifier, "discord"), "Roll");}
            }

            else{popupAlert("Fill in all three boxes: how many dice, how many sides, and the modifier.");} //If one or more of the values are missed
        break;
    
        default:
            if(document.getElementById("adv").value != "Advantage/Disadvantage") 
            { 
                let take = parseInt(diceRoller(`1`, `20`, `${modifier[1]}`, "finalResult"));
                let take2 = parseInt(diceRoller(`1`, `20`, `${modifier[1]}`, "finalResult"));
                let usersRoll;

                switch(document.getElementById("adv").value)
                {
                    case "Advantage":
                        if(take > take2){usersRoll = take;} else {usersRoll = take2;}
                        break;

                    case "Disadvantage":
                        if(take < take2){usersRoll = take;} else {usersRoll = take2;}
                        break;
                }

                popupAlert(`${window.name} rolled 1d20+${modifier[1]}: (${parseInt(usersRoll)-modifier[1]})+${modifier[1]}= ${usersRoll} on their ${modifier[0]}. First Roll: ${take}, Second Roll: ${take2}.`, "Roll");
            }

            else{popupAlert(`${diceRoller("1", "20", modifier[1], "discord")} on their ${modifier[0]}.`, "Roll");}
            break;
    }
}

/**
 * Rolls `amount` dice with `dice` sides and returns each result in a list.
 */
function basicRoll(amount, dice)
{
    let rolls = [];

    for(let i = 0; i < amount; i++) //Rolls for each dice needed
    {
        let random = Math.random();
        let roll = Math.floor(random * (parseInt(dice))) + 1; //Gives random roll
        rolls.push(roll);
    }

    return rolls; //Returns all rolls
}

/**
 * Rolls amountd(dice)+modifier and returns the worked-out message, or just the total
 * when ifName is "finalResult".
 */
function diceRoller(amount, dice, modifier, ifName)
{
    let rolls = basicRoll(amount, dice); //rolls each die
    let sum = 0;
    let inspo = false;
    let viewMod = `${modifier}`;
    if(modifier >= 0 && !viewMod.includes("+")){viewMod = "+" + modifier;} //Adds the + if the modifier is positive
    let message = ""; 
    if(ifName == "discord"){message = `${wholeStat["stats"]["name"]} rolled `;} //Creates the message for discord
    message += `${amount}d${dice}${viewMod}: (`;
    
    for(let roll of rolls) //For each die that was rolled
    {
        sum += roll; //Adds the result to the sum
        message += `${roll}+`; //Adds the number to the message
    }

    if(message[message.length-1] == "+") //If the last thing in the message is +
    {
        message = message.slice(0, message.length - 1); //Removes the +
    }
    
    let finalResult = sum + parseInt(modifier); //Adds the sum and modifier

    message += `)${viewMod}= ${finalResult}`;

    if(ifName == "finalResult"){message = `${finalResult}`;}

    return message;
}

/**
 * Trash icon: lists every sheet again in delete mode (click one to delete it).
 */
function handleDeleteBtn()
{
    let display = document.getElementById("createNew");
    let shared = document.createElement("div");

    shared.id = "sharedDelete";
    display.innerHTML = `<h3>Delete Who?</h3>`;
    display.parentElement.appendChild(shared);

    generateSheets("createNew", "sharedDelete", "delete");
}

/**
 * Deletes an owned sheet, or removes a sheet from Shared Sheets (the owner keeps it), then reloads.
 */
function deleteSheet(relation, charName)
{
    switch(relation)
    {
        case "shared":
            deleteDoc(`playerChar/${player}/sharedSheets/${charName}`);
            break;

        case "owned":
            deleteDoc(`playerChar/${player}/${charName}`);
            break;
    }

    deleteDoc(`playerChar/${player}/currentSheet`);
    reload(0.5);
}

/**
 * + button: shows a box for the new character's name and a Create! button.
 */
function handleCreateNewSheet()
{
    let display = document.getElementById("createNew");

    display.innerHTML = 
    `
        <h6 style="display: inline; margin: 5px;" class = "text-brass">Character's Name:</h6><input style="display: inline;" id="name"/>
        <button id="done">Create!</button>
    `;
    document.getElementById("done").onclick = createNewSheet;
}

/**
 * Creates a new sheet with just its name filled in.
 */
function createNewSheet()
{
    let name = document.getElementById("name");
    if(name.value != ""){setDoc(`playerChar/${player}/${name.value}/stats`, {"name":name.value}); document.getElementById("createNew").innerHTML = "";}
    else{popupAlert("Give the character a name.");}
}

/**
 * Portrait upload box changed: uploads the picture as this character's portrait.
 * Put on `window` because the HTML calls it from onchange.
 */
function uploadFile(event)
{
    let structure = `Bucket/${player}/${charName}-img`;
    popupAlert("Pictures take a moment to upload. Please don't refresh; the page updates on its own.", "Uploading")
    handleImageUpload(event, structure, "portrait", player, charName);
}

window.uploadFile = uploadFile;

/**
 * Opens a sheet: remembers it as currentSheet, shows the dice roller and portrait
 * upload, loads stats.html for it in the frame, and applies the saved zoom.
 */
function handleShowSheet(playerName, name)
{
    let div = document.getElementById("sheet");
    div.innerHTML = "";
    setDoc(`playerChar/${player}/currentSheet`, `${playerName}-${name}`);

    charName = name;
    document.getElementsByClassName("dice")[0].style.display = "block";

    document.getElementById("uploadLabel").style.display = "inline";
    document.getElementById("uploadBTN").style.display = "inline";

    if(!wholeChar[playerName][name]["image"])
    {
        setDoc(`playerChar/${playerName}/${name}/image`, `None`);
    }

    else //Update portrait to match
    {
        if(wholeChar[playerName][name]["image"] != "None")
        {
            document.getElementById("portrait").src = wholeChar[playerName][name]["image"];
            document.getElementById("portrait").style.display = "block";
        }
    }

    window.name = name;
    div.innerHTML = 
    `
    <div id="frame" draggable="false">
        <iframe id="statSheet" src="stats.html?${name}-${playerName}" title="stats" style="-webkit-text-size-adjust: none; transform-origin:left top;" draggable="false"></iframe>
    </div>
    `; 

    document.title = `${name}'s Sheet`;

    if(wholeChar[player]["zoomSheetLevel"])
    {
        applySheetZoom(wholeChar[player]["zoomSheetLevel"]);
    }

    wholeStat = wholeChar[playerName][name];
}

/**
 * Shows the sheet at `level`% zoom. The frame is scaled down from its top-left corner, so it
 * is made wider and taller by 100/level to still fill the space once shrunk. Its layout box
 * stays that big, so a negative bottom margin of exactly (layout height - shown height)
 * pulls the content below back up. That keeps no blank gap under the sheet at any zoom.
 */
function applySheetZoom(level)
{
    let frame = document.getElementById("statSheet");
    if(!frame || !level){return;}

    let scale = level / 100;
    let shown = 125;              //Height the sheet should take on screen, in vh
    let layout = shown / scale;   //Height before scaling

    frame.style.transformOrigin = "left top";
    frame.style.transform = `scale(${scale})`;
    frame.style.width = `${100 / scale}%`;
    frame.style.height = `${layout}vh`;
    frame.style.marginBottom = `-${layout - shown}vh`;
}

/**
 * Sheet zoom +/-: changes the saved zoom (30%–100%) in steps of 10. The page applies it
 * when the database updates.
 */
function handleButton()
{
    let modifier = this.innerHTML;
    let zoomLevel = 100;

    if(wholeChar[player]["zoomSheetLevel"]){zoomLevel = wholeChar[player]["zoomSheetLevel"];}
    
    switch(this.name) //Checks case on the property of which name was clicked
    {
        case "zoomSheet":
            let zoomSheetLevel = 100; if(wholeChar[player]["zoomSheetLevel"]){zoomSheetLevel = wholeChar[player]["zoomSheetLevel"];}
            if(modifier == "+") //If plus button is 
            {
                if(zoomSheetLevel < 100){zoomSheetLevel += 10;}
            }

            else //minus button is clicked
            {
                zoomSheetLevel -= 10;
                if (zoomSheetLevel < 30){zoomSheetLevel = 30;}
            }

            setDoc(`playerChar/${player}/zoomSheetLevel`, zoomSheetLevel);
            break;
    }
}