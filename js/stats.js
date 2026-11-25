/**
 * stats.js — the character sheet (stats.html), shown inside index.html once a sheet is opened.
 *
 * Unlike the campaign sites, this sheet opens its own database connection. Which sheet to
 * show comes from the account's currentSheet value, "<Owner>-<Character>", which also lets
 * someone open a sheet that was shared with them. Every saved field lives at
 * playerChar/<Owner>/<Character>/stats/<id>.
 *
 * How the sheet is wired:
 *   • Every saved field has class="stat" and an id matching its database key.
 *   • Checkboxes ending in "-btn" are proficiencies; the bonus next to each is calculated.
 *   • Ability scores have class "base6"; changing one recalculates its modifier.
 *   • Spell boxes (can-1, lvl1-1, ...) have an eye icon (id + "-See") that opens the spell,
 *     and spell slots draw clickable slot icons.
 *   • Right-click a skill or Initiative to roll a d20 with that bonus.
 *   • Right-click a spell, weapon or action name to roll it: a saved roll preset with that
 *     name is used first; otherwise one is built from the site's spell/weapon lists
 *     (decryptSpellOrAction) and rolled by index.js's rollPreset().
 *   • Share gives a link that adds this sheet to someone else's Shared Sheets.
 */

"use strict";
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, statFormat, skillDecrypt, reload, deleteDoc, showPopup, popupAlert } from './viMethods.js';
import { openSpellEditor, shareSpell } from './spellEditor.js';
import { descriptionHtml } from './spellText.js';

let player;
let wholeChar = {};
let stats;
let sheet; 
let firstRun = true;
let wholeSpells;
let wholeActions;

fetch('https://dnd.axol-apps.com/src/spells.json').then(res => res.json()).then((json) =>
{
    wholeSpells = json;
    //Plus the spells the Worker has added from Open5e (shared with the D&D site)
    return fetch(`${SPELL_SERVICE}/spells`).then(res => res.ok ? res.json() : {}).then((extra) => mergeSpells(wholeSpells, extra)).catch(() => {});
});
fetch('https://dnd.axol-apps.com/src/actions.json').then(res => res.json()).then((json) => wholeActions = json);

const charRef = ref(database, 'playerChar/');
onValue(charRef, (snapshot) => 
{
    wholeChar = snapshot.val() ?? {};
    startSheet();
});

// Starts the sheet once both the login and the data are known (either can come first)
function startSheet()
{
    if(firstRun && player && wholeChar?.[player]?.["currentSheet"])
    {
        firstRun = false;
        sheet = wholeChar[player]["currentSheet"].split("-");
        sheet[0] = toTitleCase(sheet[0]);
        sheet[1] = toTitleCase(sheet[1]);
        init();
    }
}

onAuthStateChanged(auth, (user) => 
{
    if (user) 
    {
        player = auth.currentUser.email.split("@");
        player = toTitleCase(player[0]);
        startSheet();
    } 
});

/**
 * Fills every class="stat" field from the saved sheet. Calculated fields (spell attack bonus,
 * spell save DC, proficiency bonus, hit dice) are worked out here and saved back.
 * Also hooks up the eye icons, right-click rolls on skills / spells / actions, the Share
 * button and the hit-dice buttons.
 */
function init()
{
    let display = document.getElementById("story");
    let stats = document.getElementsByClassName("stat");
    let viewButtons = document.getElementsByClassName("viewSpell");
    let exitBtn = document.getElementById("exitIframe");
    exitBtn.onclick = handleExit;
    document.getElementById("spellBackdrop").onclick = handleExit; //Click outside the popup to close it
    document.addEventListener("keydown", (e) => {if(e.key == "Escape"){handleExit();}});

    for(let stat of stats)
    {
        if(wholeChar[sheet[0]][sheet[1]]["stats"][stat.id] || wholeChar[sheet[0]][sheet[1]]["stats"][stat.id] == "")
        {
            if(typeof wholeChar[sheet[0]][sheet[1]]["stats"][stat.id] == "string")
            {
                if(stat.id == "spellBonus"){let bonus = statFormat(parseInt(wholeChar[sheet[0]][sheet[1]]["stats"][wholeChar[sheet[0]][sheet[1]]["stats"]["spellAbility"]]) + parseInt(wholeChar[sheet[0]][sheet[1]]["stats"]["proficiency"])); stat.innerHTML = bonus; setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/spellBonus`, bonus);}
                else if(stat.id == "spellDC"){let dc = statFormat(parseInt(wholeChar[sheet[0]][sheet[1]]["stats"][wholeChar[sheet[0]][sheet[1]]["stats"]["spellAbility"]]) + parseInt(wholeChar[sheet[0]][sheet[1]]["stats"]["proficiency"]) + 8); stat.innerHTML = dc; setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/spellDC`, dc);}
                else if(stat.id == "proficiency"){let prof = statFormat(Math.ceil(parseInt(wholeChar[sheet[0]][sheet[1]]["stats"]["lv"])/4)+1); setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/proficiency`, prof); stat.innerHTML = prof;}
                else if(stat.id == "totalHitDice"){for(let i = 0; i < stat.length; i++){stat[i].innerHTML = `${wholeChar[sheet[0]][sheet[1]]["stats"]["lv"]}${stat[i].value}`; stat.value = wholeChar[sheet[0]][sheet[1]]["stats"][stat.id];}}
                else if(stat.id == "currentHitDice"){let max = wholeChar[sheet[0]][sheet[1]]["stats"]["totalHitDice"]; stat.innerHTML = ""; for(let i = parseInt(wholeChar[sheet[0]][sheet[1]]["stats"]["lv"]); i >= 0; i--){let option = document.createElement("option"); option.innerHTML = `${i}${max}`; option.value = `${i}`; stat.appendChild(option);} stat.value = wholeChar[sheet[0]][sheet[1]]["stats"][stat.id];}
                else if(stat.id.includes("-btn") && !stat.id.includes("lvl")){stat.checked = false; setStats(stat);} //Stats not clicked
                else if(stat.id.includes("Save")){stat.checked = false; setStats(stat);} //Stats not clicked
                else if(["spellAbility", "lv"].includes(stat.id)){stat.value = wholeChar[sheet[0]][sheet[1]]["stats"][stat.id];}
                else if(stat.value == ""){stat.value = wholeChar[sheet[0]][sheet[1]]["stats"][stat.id]; if(!["profAndLang", "infusion", "feats", "equipment", "apperance", "characterBackstory", "ally1", "ally2", "additionalFeat&Traits", "treasure"].includes(stat.id)){stat.style.minWidth = stat.value.length + 2 + "ch";}}
                else{stat.innerHTML = wholeChar[sheet[0]][sheet[1]]["stats"][stat.id];}
            }

            else
            {
                stat.checked = wholeChar[sheet[0]][sheet[1]]["stats"][stat.id];
                setStats(stat);
            }
        }

        else
        {
            if(stat.id.includes("-btn") && !stat.id.includes("lvl")){setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${stat.id}`, false); }
            else{setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${stat.id}`, "");}
            setStats(stat);
        }

        if(stat.id.includes("slot")){updateCheckboxes(stat.id.split("level")[1].charAt(0));}

        stat.onchange = updateStat;
        if(stat.type != "checkbox"){stat.oninput = scheduleAutosave;} //Saves after a pause in typing
    }

    for(let viewButton of viewButtons)
    {
        viewButton.onclick = showSpell;
        viewButton.oncontextmenu = function(e) {e.preventDefault(); handleActionRightClickRoll(toTitleCase(document.getElementById(this.id.slice(0, this.id.length - 4)).value));};

        if(document.getElementById(viewButton.id.slice(0, viewButton.id.length - 4)).value == "")
        {
            viewButton.classList.add("invisible");
        }
    }

    for(let stat of document.getElementsByClassName("expertise")){stat.onclick = handleExpertise; stat.oncontextmenu = function(e) {e.preventDefault(); handleRightClickRoll(e, "stat");};}

    document.getElementById("Initiative").oncontextmenu = function(e) {e.preventDefault(); handleRightClickRoll(e, "init");};
    document.getElementById("initLabel").oncontextmenu = function(e) {e.preventDefault(); handleRightClickRoll(e, "init");};

    document.getElementById("shareButton").onclick = function() {showPopup({title: "Share this sheet", message: "Copy this link and give it out. Anyone with the link can edit your sheet.", input: {value: `https://sheets.axol-apps.com/index.html?${sheet[0]}-${sheet[1].replaceAll(" ", "%20")}`}, copy: true, buttons: [{label: "Done", value: true, primary: true}]});};

    for(let element of document.getElementsByClassName("spells")){element.oncontextmenu = function(e) {e.preventDefault(); handleActionRightClickRoll(toTitleCase(this.value));};}

    for (let i = 1; i <= 3; i++) {
        let actionInput = document.getElementById(`actionName${i}`);
        
        if (actionInput) 
        {
            actionInput.oncontextmenu = function(e) 
            {
                let actionName = actionInput.value.trim();
                
                if (actionName) 
                {
                    e.preventDefault(); // Stop standard browser right-click menu
                    handleActionRightClickRoll(actionName);
                }
            };
        }
    }

    document.getElementById('add-hd').onclick = addNewHD;
    document.getElementById('remove-hd').onclick = removeRecentHD;
    loadMulticlassHitDice();
}

/**
 * Draws the hit-dice rows. Each row is one class: how many levels (dice) of it, the die
 * size (d4–d20), and how many of those dice are left. Rows can never add up to more than
 * the character's level; if they do, later rows are trimmed. Changing any dropdown
 * redraws the rows and saves them.
 */
function createHD(hdStateArray)
{
    let totalBox = document.getElementById("hd-div");
    let currentBox = document.getElementById("hd-current");

    currentBox.innerHTML = "";
    totalBox.innerHTML = "";

    let maxGlobalLevel = wholeChar[sheet[0]][sheet[1]]["stats"]["lv"];
    let standardDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

    if(!hdStateArray || hdStateArray.length === 0) //If no multiclass
    {
        hdStateArray = [{ totalCount: maxGlobalLevel, dieSize: 'd8', currentCount: maxGlobalLevel }];
    }

    let allocatedLevels = 0;
    hdStateArray.forEach((group) => 
    {
        allocatedLevels += parseInt(group.totalCount) || 0;
    });

    if (allocatedLevels > maxGlobalLevel) 
    {
        let pool = maxGlobalLevel;
        hdStateArray.forEach((group) => 
        {
            group.totalCount = Math.min(group.totalCount, pool);
            pool -= group.totalCount;
            if (group.totalCount < 1 && pool === 0) group.totalCount = 0; // handle trailing entries safely
            group.currentCount = Math.min(group.currentCount, group.totalCount);
        });
    }

    // Pass 2: Draw components onto the page matching layout rules
    let cumulativeUsed = 0;
    hdStateArray.forEach((classGroup, index) => {
        // Skip drawing rendering elements for fully dead tracking slots
        if (index > 0 && classGroup.totalCount === 0 && hdStateArray.length > 1) return;

        // Calculate maximum allowable selection for this row item without breaking overall character max limit
        const otherRowsAllocated = hdStateArray.reduce((acc, g, i) => acc + (i !== index ? g.totalCount : 0), 0);
        const maxRowAllocation = Math.max(1, maxGlobalLevel - otherRowsAllocated);

        // --- Render Total Configurations Column Section ---
        const totalRow = document.createElement('div');
        totalRow.className = 'hd-total-row-item';
        totalRow.style.margin = '4px 0';
        totalRow.dataset.index = index;

        let totalOptions = '';
        for (let i = 1; i <= maxRowAllocation; i++) {
            totalOptions += `<option value="${i}" ${classGroup.totalCount == i ? 'selected' : ''}>${i}</option>`;
        }

        let dieOptions = '';
        standardDice.forEach(die => {
            dieOptions += `<option value="${die}" ${classGroup.dieSize === die ? 'selected' : ''}>${die}</option>`;
        });

        totalRow.innerHTML = `
            <select class="hd-total-select" style="width: 45px; text-align: center;">${totalOptions}</select>
            <select class="hd-die-select" style="width: 55px; margin-left: 2px;">${dieOptions}</select>
        `;
        totalBox.appendChild(totalRow);

        // --- Render Current Remaining Selector Column Section ---
        const currentRow = document.createElement('div');
        currentRow.className = 'hd-current-row-item';
        currentRow.style.margin = '4px 0';
        currentRow.style.display = "inline";
        currentRow.dataset.index = index;

        let currentOptions = '';
        for (let i = classGroup.totalCount; i >= 0; i--) {
            // Displays with custom dynamic text formatting (e.g., "6d8", "0d6") matching your setup design
            currentOptions += `<option value="${i}" ${classGroup.currentCount == i ? 'selected' : ''}>${i}${classGroup.dieSize}</option>`;
        }

        currentRow.innerHTML = `
            <select class="hd-current-select" style="width: 70px; text-align: center;">${currentOptions}</select>
        `;
        currentBox.appendChild(currentRow);

        // --- Bind Listener Logic Rules ---
        const totalSelect = totalRow.querySelector('.hd-total-select');
        const dieSelect = totalRow.querySelector('.hd-die-select');
        const currentSelect = currentRow.querySelector('.hd-current-select');

        // Handle cascading structural changes across rows when levels are modified
        totalSelect.onchange = function() {
            classGroup.totalCount = parseInt(this.value);
            classGroup.currentCount = Math.min(classGroup.currentCount, classGroup.totalCount);
            // Re-evaluate entire stack array to apply updated calculations to neighboring elements
            createHD(serializeHDInterface());
            commitHDStateToDatabase();
        };

        // Re-draw dropdown labels immediately when the selected die format changes
        dieSelect.onchange = function() {
            classGroup.dieSize = this.value;
            createHD(serializeHDInterface());
            commitHDStateToDatabase();
        };

        currentSelect.onchange = function() {
            commitHDStateToDatabase();
        };
    });
}

/**
 * "+" next to hit dice: adds another class row (1 level of d6) for multiclassing,
 * unless the levels already add up to the character's level.
 */
function addNewHD() 
{
    const dynamicStack = serializeHDInterface();
    const maxAllowedLevel = wholeChar[sheet[0]][sheet[1]]["stats"]["lv"];
    
    let currentAllocatedSum = 0;
    dynamicStack.forEach(g => currentAllocatedSum += g.totalCount);

    // Stop adding rows if the level budget is already fully spent
    if (currentAllocatedSum >= maxAllowedLevel) {
        popupAlert("Can't add another hit dice row: the rows already add up to your character's level.");
        return;
    }

    dynamicStack.push({ totalCount: 1, dieSize: 'd6', currentCount: 1 });
    createHD(dynamicStack);
    commitHDStateToDatabase();
}

/**
 * "-" next to hit dice: removes all multiclass rows, back to one row covering every level.
 */
function removeRecentHD() 
{
    const baseCap = wholeChar[sheet[0]][sheet[1]]["stats"]["lv"];
    const baselineCollection = [{ totalCount: baseCap, dieSize: 'd6', currentCount: baseCap }];
    createHD(baselineCollection);
    commitHDStateToDatabase();
}

/**
 * Reads the hit-dice rows back out of the page into a list of
 * { totalCount, dieSize, currentCount } objects.
 */
function serializeHDInterface() 
{
    const totalRowElements = document.querySelectorAll('.hd-total-row-item');
    const currentRowElements = document.querySelectorAll('.hd-current-row-item');
    const stateOutputArray = [];
    
    totalRowElements.forEach((totalRow, idx) => {
        const correspondingCurrentRow = currentRowElements[idx];
        if (correspondingCurrentRow) {
            stateOutputArray.push({
                totalCount: parseInt(totalRow.querySelector('.hd-total-select').value) || 1,
                dieSize: totalRow.querySelector('.hd-die-select').value || 'd8',
                currentCount: parseInt(correspondingCurrentRow.querySelector('.hd-current-select').value) || 0
            });
        }
    });
    
    return stateOutputArray;
}

/**
 * Saves the current hit-dice rows to stats/multiclassHitDice.
 */
function commitHDStateToDatabase() 
{
    const valuesPayload = serializeHDInterface();
    // Formulates character reference node paths mirroring your standard setDoc setup
    setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/multiclassHitDice`, valuesPayload);
}

/**
 * Draws the hit dice from what's saved (or one default row if nothing is saved yet).
 */
function loadMulticlassHitDice() 
{
    if (wholeChar[sheet[0]] && wholeChar[sheet[0]][sheet[1]]["stats"]) 
    {
        const cloudRecord = wholeChar[sheet[0]][sheet[1]]["stats"]["multiclassHitDice"];
        createHD(cloudRecord);
    } 
    
    else 
    {
        createHD(null);
    }
}

/**
 * Right-click roll for a spell, weapon or action by name. Uses the sheet's roll preset of
 * that name if there is one; otherwise looks the name up in the weapons list, then the
 * spell list (plural names like "Daggers" are made singular), builds a preset from its
 * description and rolls it. Shows a message if it can't be rolled automatically.
 */
function handleActionRightClickRoll(name)
{
    let parentWin = window.top.parent;
    let presets = wholeChar[sheet[0]][sheet[1]]["presets"];
    let activeKey = null;
    let type;
    
    let lowerName = name.trim().toLowerCase();
    let filterName = removePlur(name.trim());

    for(let key in presets)
    {
        if(lowerName == key.toLowerCase() || lowerName.replaceAll(" ", "") == key.toLowerCase().replaceAll(" ", ""))
        {
            activeKey = key;
        }
    }

    if(activeKey)
    {
        parentWin.rollPreset(presets[activeKey]);
        return;
    }

    else
    {
        let weapons = wholeActions["Weapons"];
        let spells = wholeSpells;

        for(let weapon in weapons)
        {
            if(filterName == weapon)
            {
                activeKey = weapons[weapon];
                type = "weapon";
            }
        }

        for(let levelKey in wholeSpells)
        {
            let levelCategory = wholeSpells[levelKey];
        
            for (let spKey in levelCategory) 
            {
                let spellItem = levelCategory[spKey];
                let spellName = spellItem.name.trim();

                if (spellName == filterName) 
                {
                    activeKey = spellItem;
                    type = "spell"
                    break;
                }
            }
            
            if (activeKey) break; // Stop scanning higher levels if match is found
        }

        if(activeKey)
        {
            let preset = null;
            preset = decryptSpellOrAction(activeKey["description"], filterName);
            
            if(preset != null)
            {
                parentWin.rollPreset(preset);
                return;
            }
            
            else
            {
                popupAlert(`${activeKey["name"] ?? name} isn't set up to roll automatically yet. Ask Vi to fix it.`);
            }
        }

        else
        {
            popupAlert(`${name} isn't set up to roll automatically yet. Ask Vi to fix it.`);
        }
    }
}

/**
 * Empty placeholder; not used.
 */
function handleRightClickSpellRoll(e, name)
{

}

/**
 * Makes a name singular for matching ("Daggers" -> "Dagger"), but leaves "...ss" alone.
 */
function removePlur(name)
{
    if(name.endsWith("s") && !name.endsWith("ss"))
    {
        if(name.endsWith("es") > name.length > 3)
        {
            return name.slice(0, -1);
        }

        return name.slice(0, -1);
    }

    return name;
}

/**
 * Builds a roll preset from a spell/weapon description written in the site's markup:
 *   accuracy: from {+5toHit}, else the sheet's spell attack bonus, or "save" for {@save} spells
 *   damage:   from {@damage 1d8+$Strength$} or {@save 2d6} -> count, die size, modifier
 *   type:     the damage type named in the text (Fire, Slashing...)
 * Returns null if there's no damage to roll.
 */
function decryptSpellOrAction(descText, name)
{
    let preset = {"name": name, "accuracyBonus": "0", "rolls" : [{"damageType": "Weapon", "modifier": "+0", "qty": 1, "type": "d6"}]};
    let damageTypes = ["Slashing", "Piercing", "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"];
    
    if(descText.includes("DextarityOrStrength"))
    {
        descText = descText.replaceAll("(DextarityOrStrength)", "$Dexterity$");
        descText = descText.replaceAll("(DexterityOrStrength)", "$Dexterity$");
        descText = descText.replaceAll("(DextarityOrStrength", "$Dexterity$");
    }

    if(descText.includes("&Proficiency"))
    {
        descText = descText.replaceAll("&Proficiency)", "+$proficiency$");
    }

    let toHit = descText.match(/{([^}]+)toHit}/);
    if (toHit) 
    {
        preset.accuracyBonus = toHit[1].trim();
    }

    else
    {
        if(!descText.includes("{@save"))
        {
            if(wholeChar[sheet[0]][sheet[1]]["stats"]["spellBonus"] != "")
            {
                preset.accuracyBonus = wholeChar[sheet[0]][sheet[1]]["stats"]["spellBonus"];
            }

            else
            {
                preset.accuracyBonus = "+0";
            }
        }
        
        else
        {
            preset.accuracyBonus = "save";
        }
    }

    let damage;
    if(descText.includes("{@damage")){damage = descText.match(/{@damage\s+([^}]+)}/);} 
    else if(descText.includes("{@save")){damage = descText.match(/{@save\s+([^}]+)}/);}

    if (damage) 
    {
        let rawFormula = damage[1]; // e.g. "1d8+$Strength$"
        if (rawFormula.includes("d")) 
        {
            let formulaParts = rawFormula.split("d");
            preset["rolls"][0]["qty"] = formulaParts[0] || "1";
            
            if (formulaParts[1].includes("+")) //If Modifier is Positive
            {
                let subParts = formulaParts[1].split("+");
                preset["rolls"][0]["type"] = "d" + subParts[0].replace(/[^0-9]/g, ""); //Gets the dice's size
                preset["rolls"][0]["modifier"] = subParts.slice(1).join("+"); //Gets the modifier
            } 
            
            else if (formulaParts[1].includes("-")) //If Modifier is Negative
            {
                let subParts = formulaParts[1].split("-");
                preset["rolls"][0]["type"] = "d" + subParts[0].replace(/[^0-9]/g, "");
                preset["rolls"][0]["modifier"] = "-" + subParts.slice(1).join("-");
            } 
            
            else //If no Modifier
            {
                preset["rolls"][0]["type"] = "d" + formulaParts[1].replace(/[^0-9]/g, "");
                preset["rolls"][0]["modifier"] = "0";
            }

            for(let damageType of damageTypes)
            {
                if(descText.toLowerCase().includes(damageType.toLowerCase()))
                {
                    preset["rolls"][0]["damageType"] = damageType;
                }
            }

            return preset;
        }
    }

    else
    {
        return null;
    }

    return null;
}

/**
 * Draws the spell-slot icons for one spell level: as many as the slot-count box says.
 * Each is a hidden checkbox + a label showing the slot picture (CSS swaps in the "used"
 * picture when checked). Each slot's used/unused state is saved on its own.
 */
function updateCheckboxes(level)
{
    let input = document.getElementById(`level${level}-slot`);
    let display = document.getElementById(`level${level}-slot-display`);

    if(!input || !display){return;}

    let count = parseInt(input.value) || 0;
    display.innerHTML = "";

    for(let i = 0; i < count; i++)
    {
        let id = `level${level}-cb-${i}`;
        
        let box = document.createElement('input');
        box.type = 'checkbox';
        box.id = id;
        box.style.display = "none";
        box.className = "spell-check-hidden";

        if(wholeChar[sheet[0]][sheet[1]]["stats"][id] == true || wholeChar[sheet[0]][sheet[1]]["stats"][id] == false)
        {
            box.checked = wholeChar[sheet[0]][sheet[1]]["stats"][id];
        }

        else
        {
            setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${id}`, false);
        }

        box.onchange = function(){setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${id}`, box.checked);};

        let label = document.createElement('label');
        label.setAttribute("for", id);
        label.className = 'spell-slot-label';
        
        display.appendChild(box);
        display.appendChild(label);
    }
}

/**
 * Works out and shows the bonus for one skill or saving throw from its "-btn" checkbox:
 * the ability modifier, + proficiency if ticked, + proficiency again with expertise.
 * Bards add half proficiency to skills they aren't proficient in (Jack of All Trades).
 */
function setStats(stat)
{
    if(stat.id.includes("-btn") && !stat.id.includes("lvl"))
    {
        let display;
        let skill;
        let modifier;
        let exper;

        if(stat.id.includes("Save-btn"))
        {
            skill = stat.id.slice(0, stat.id.length-8);
            modifier = wholeChar[sheet[0]][sheet[1]]["stats"][skill];
            display = document.getElementById(skill + "Save");
            exper = skill + "Save";
        }

        else
        {
            skill = stat.id.slice(0, stat.id.length-4);
            let base6 = skillDecrypt[skill];
            modifier = wholeChar[sheet[0]][sheet[1]]["stats"][base6];
            display = document.getElementById(skill);
            exper = skill;
        }

        if(stat.checked)
        {
            modifier = parseInt(modifier) + parseInt(wholeChar[sheet[0]][sheet[1]]["stats"]["proficiency"]);

            if(wholeChar[sheet[0]][sheet[1]]["stats"][`${exper}-expertise`]){modifier += parseInt(wholeChar[sheet[0]][sheet[1]]["stats"]["proficiency"]);}
        } 
        
        else if(!stat.checked && (wholeChar[sheet[0]][sheet[1]]["stats"]["class"] ?? "").toLowerCase().includes("bard"))
        {
            modifier = parseInt(modifier) + Math.floor(parseInt(wholeChar[sheet[0]][sheet[1]]["stats"]["proficiency"]) / 2);
        }

        modifier = statFormat(modifier);
        setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${stat.id.slice(0, stat.id.length-4)}`, modifier);
        display.innerHTML = toTitleCase(skill + ": " + modifier);
        if(wholeChar[sheet[0]][sheet[1]]["stats"][`${exper}-expertise`]){display.innerHTML += " <strong>(Expertise)</strong>"}
    }
}

/**
 * Clicking a proficient skill's name toggles expertise for it, then redraws the sheet.
 */
function handleExpertise()
{
    let stat = this.id;
    let button = document.getElementById(stat + "-btn");

    if(button.checked)
    {
        if(wholeChar[sheet[0]][sheet[1]]["stats"][`${stat}-expertise`])
        {
            deleteDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${stat}-expertise`);
        }

        else
        {
            setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${stat}-expertise`, true);
        }

        setTimeout(init, 1000);
    }
}

/**
 * Runs when any sheet field changes, and saves it. Special cases:
 *   checkboxes        -> save true/false and recalculate that bonus
 *   multi-line boxes  -> each line gets a "•" bullet
 *   ability scores    -> recalculate and save the modifier
 *   spell boxes       -> show or hide the eye icon
 *   spell-slot counts -> redraw the slot icons
 * Text boxes also grow to fit what was typed.
 */
function updateStat()
{
    autosaveWaiting.delete(this); //Saved properly below
    let setTo = this.value;

    if(setTo == "on")
    {
        setTo = this.checked;
        setStats(this);
    }

    else if(setTo.includes("\n"))
    {
        setTo = setTo.split("\n");

        for(let i = 0; i < setTo.length; i++)
        {
            if(setTo[i][0] != "•" && setTo[0] != " " && setTo[i][0] != " "){setTo[i] = "•   " + setTo[i];} 
            if(setTo[i] == "•   "){setTo[i] = "";}
        }

        setTo = setTo.join("\n");

        this.value = setTo;
    }

    else if(this.classList.contains("base6"))
    {
        let full = this.value;
        let smaller;
        let ref = document.getElementById(this.id.slice(0, this.id.length-4));

        full = parseInt(full);
        smaller = (full - 10) / 2;
        smaller = statFormat(Math.floor(smaller));
        ref.innerHTML = smaller;
        setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${this.id.slice(0, this.id.length-4)}`, smaller);
        setTimeout(init, 1000);
    }

    else if(["lv", "spellAbility", "totalHitDice"].includes(this.id)){setTimeout(init, 1000);}

    else
    {
        if(!["profAndLang", "infusion", "feats", "equipment", "apperance", "characterBackstory", "ally1", "ally2", "additionalFeat&Traits", "treasure"].includes(this.id)){this.style.minWidth = this.value.length + 2 + "ch";}
    }

    setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${this.id}`, setTo);

    if(this.id.includes("lvl") || this.id.includes("can"))
    {
        if(setTo != "")
        {
            document.getElementById(this.id + "-See").classList.remove("invisible");
        }

        else
        {
            document.getElementById(this.id + "-See").classList.add("invisible");
        }
    }

    if(this.id.includes("slot"))
    {
        updateCheckboxes(this.id.split("level")[1].charAt(0));
    }
}

/* ------------------------------------------------------------------------------------ *
 *  Spells missing from the D&D site's spells.json                                       *
 *  The Cloudflare Worker looks a missing spell up on Open5e, converts it to the sites'  *
 *  format and keeps it, so this site and the D&D site both have it from then on.        *
 * ------------------------------------------------------------------------------------ */
const SPELL_SERVICE = "https://statblock.vitheaxolotl.workers.dev";

/** The spell with this name (any level, any capitalisation): {level, key, spell} or null. */
function findSpellIn(spells, name)
{
    let target = String(name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if(!target){return null;}

    for(let [level, list] of Object.entries(spells ?? {}))
    {
        for(let [key, spell] of Object.entries(list ?? {}))
        {
            if(key != "hold" && (key.toLowerCase() == target || String(spell?.["name"] ?? "").toLowerCase() == target)){return {level, key, spell};}
        }
    }
    return null;
}

/** Adds the shared list's spells ({level: {Name: spell}}); an edited spell replaces the built-in copy. */
function mergeSpells(target, extra)
{
    for(let [level, list] of Object.entries(extra ?? {}))
    {
        for(let [name, spell] of Object.entries(list ?? {}))
        {
            removeNamed(target, name);
            (target[level] ??= {})[name] = spell;
        }
    }
}

/** Removes every spell called `name` (any level, any capitalisation). */
function removeNamed(target, name)
{
    let lower = String(name).toLowerCase();
    for(let list of Object.values(target ?? {}))
    {
        for(let key of Object.keys(list ?? {})){if(key != "hold" && key.toLowerCase() == lower){delete list[key];}}
    }
}

/** Finds a spell in the list, or through the Worker (which adds it for next time). */
async function findSpell(name)
{
    let have = findSpellIn(wholeSpells, name);
    if(have){return have;}

    try
    {
        let response = await fetch(`${SPELL_SERVICE}/spell?name=${encodeURIComponent(String(name).trim())}`);
        if(!response.ok){return null;}
        let data = await response.json();
        if(!data?.spell){return null;}
        if(wholeSpells){(wholeSpells[data.level] ??= {})[data.spell.name] = data.spell;}
        return {level: data.level, key: data.spell.name, spell: data.spell};
    }
    catch(error)
    {
        console.error("Spell lookup failed:", error);
        return null;
    }
}

/**
 * Eye icon next to a spell: shows its card on a parchment popup (any capitalisation, any level),
 * with Edit next to Done. A spell that isn't in the list is looked up on Open5e through the
 * Worker; if that hasn't got it either, it offers Create it, or Roll20 in a new tab (Roll20
 * won't open inside the site). Both popups are drawn full size on the main page.
 */
async function showSpell()
{
    let slot = document.getElementById(this.id.slice(0, this.id.length - 4));
    let spellName = slot.value.trim();
    if(spellName == ""){return;}
    let slotLevel = this.id.startsWith("can") ? "0" : this.id.slice(3, 4);

    let found = await findSpell(spellName);

    if(found)
    {
        let spell = found.spell;
        let line = (label, value) => `<p class="card-text">${label}: ${value ?? ""}</p>`;
        let choice = await showPopup({boxClass: "popupSpell", dismissValue: true, buttons: [{label: "Edit", value: "edit"}, {label: "Done", value: true, primary: true}], html:
            `<div class="card-body notes">
                <h5 class="card-title">${spell["name"]}</h5>
                ${line("Cast Time", spell["castTime"])}
                ${line("Range", spell["range"])}
                ${line("Components", spell["components"])}
                ${line("Duration", spell["duration"])}
                ${spell["concentration"] == "true" ? `<p class="card-text">Concentration</p>` : ""}
                ${descriptionHtml(spell["description"])}
            </div>`});
        if(choice == "edit"){editSharedSpell(spell, found.level, slot);}
    }

    else
    {
        let title = toTitleCase(spellName);
        let choice = await showPopup({title, message: `${title} isn't in the spell list yet. Create it to add it for everyone.`, dismissValue: true,
            buttons: [{label: "Create it", value: "create", primary: true}, {label: "Open on Roll20", value: "roll20"}, {label: "Done", value: true}]});
        if(choice == "create"){editSharedSpell({name: title}, slotLevel, slot);}
        else if(choice == "roll20"){window.open(`https://roll20.net/compendium/dnd5e/${encodeURIComponent(title)}`, "_blank", "noopener");}
    }
}

/**
 * The spell editor (spellEditor.js) for the shared spell list (this site and the D&D site):
 * Edit on a spell card, or Create it for a missing one. Saving replaces the spell for everyone;
 * if the name changed, the spell box on this sheet follows.
 */
function editSharedSpell(spell, level, slot)
{
    let isNew = !spell?.description;
    openSpellEditor({kind: "spell", entry: isNew ? {name: spell?.name ?? ""} : spell, group: level,
        title: isNew ? `New spell: ${spell?.name ?? ""}` : `Edit ${spell.name}`,
        onSave: async (values) =>
        {
            let data = await shareSpell(values);
            removeNamed(wholeSpells, data.spell.name);
            ((wholeSpells ??= {})[data.level] ??= {})[data.spell.name] = data.spell;

            if(slot && slot.value.trim().toLowerCase() != data.spell.name.toLowerCase())
            {
                slot.value = data.spell.name;
                updateStat.call(slot);
            }
            return `Saved ${data.spell.name}. Everyone on this site and the D&D site now has this version.`;
        }});
}

/* ------------------------------------------------------------------------------------ *
 *  Autosave                                                                             *
 *  Typing saves on its own 1.5 seconds after the last key, and straight away if the     *
 *  page is closed or hidden, so nothing is lost when someone closes the tab without     *
 *  clicking out of a box. It saves exactly what's typed; the usual tidy-up (bullets,    *
 *  recalculated modifiers) still happens when they click out of the box.                *
 * ------------------------------------------------------------------------------------ */
const AUTOSAVE_DELAY = 1500;
let autosaveTimer = null;
let autosaveWaiting = new Set(); //Boxes typed in since their last save

function scheduleAutosave()
{
    autosaveWaiting.add(this);
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosaveNow, AUTOSAVE_DELAY);
}

function autosaveNow()
{
    clearTimeout(autosaveTimer);
    if(!sheet?.[0] || !sheet?.[1]){autosaveWaiting.clear(); return;} //No sheet open

    for(let box of autosaveWaiting)
    {
        setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${box.id}`, box.value);
    }

    autosaveWaiting.clear();
}

//Closing the tab, switching tabs or leaving the page: save whatever is waiting now
window.addEventListener("pagehide", autosaveNow);
document.addEventListener("visibilitychange", () => {if(document.visibilityState == "hidden"){autosaveNow();}});
try{parent.addEventListener("pagehide", autosaveNow);}catch(e){}

/**
 * Closes the spell popup.
 */
function handleExit()
{
    document.getElementById("spellFrame").classList.add("invisible");
}

/**
 * Right-click roll on a skill or Initiative: rolls a d20 plus the bonus shown and pops up
 * the result.
 */
function handleRightClickRoll(e, type)
{
    let clicked = e.currentTarget.id
    let modifier;
    let mod;

    switch(type)
    {
        case "stat": 
            if(e.currentTarget.innerHTML.includes("+"))
            {
                modifier = e.currentTarget.innerHTML.slice(e.currentTarget.innerHTML.indexOf("+"));
            }
            
            else
            {
                modifier = e.currentTarget.innerHTML.slice(e.currentTarget.innerHTML.indexOf("-"));
            }
            break;

        case "init":
            modifier = document.getElementById("Initiative").value;
            clicked = "Initiative";
            break;
    }

    mod = parseInt(modifier);
    let random = Math.random();
    let roll = Math.floor(random * (20) + 1) + mod; //Gives random roll

    popupAlert(`Rolled (${roll-mod})${modifier} = ${roll} for ${toTitleCase(clicked)}.`, "Roll");
    return false;
}
