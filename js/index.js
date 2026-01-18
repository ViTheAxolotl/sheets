"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, reload, deleteDoc } from './viMethods.js';

let player;
let wholeChar = {};
let firstRun = true;
let sheets;
let playerName, name;
let htmlInfo = window.location.href;
let wholeRolls = {};
fetch('https://vitheaxolotl.github.io/sheets/src/rolls.json').then(res => res.json()).then((json) => wholeRolls = json);


const charRef = ref(database, 'playerChar/');
onValue(charRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeChar = data;

    if(firstRun)
    {
        firstRun = false;
        init();
    }

    else
    {
        if(wholeChar[player]["zoomSheetLevel"])
        {
            document.getElementById("statSheet").style.transform = `scale(${wholeChar[player]["zoomSheetLevel"]/100})`;
            document.getElementById("statSheet").style.width = `${100/(wholeChar[player]["zoomSheetLevel"]/100)}%`;
            document.getElementById("statSheet").style.marginBottom = `${((wholeChar[player]["zoomSheetLevel"]/100)-1)*70*9.4}px`;
            document.getElementById("statSheet").style.height = `${((100/wholeChar[player]["zoomSheetLevel"]))*125}vh`;
        }
    }

    loadSheets();
});

onAuthStateChanged(auth, (user) => 
{
    if (!user) 
    {
        alert("You need to login before using this resource. Click Ok and be redirected");
        window.location.href = `loginPage.html?|${htmlInfo}`; 
    } 

    else
    {
        player = auth.currentUser.email.split("@");
        player = toTitleCase(player[0]);
    }
});

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
    }
}

function updateStat()
{
    let diceMod = document.getElementById("diceMod");
    let stat = document.getElementById("statChoice").value;
    
    if(!["deathSave", "Misc", "Saves", "Checks", "Basic"].includes(stat)){if(wholeChar[playerName][name]){diceMod.innerHTML = `${toTitleCase(stat)}: ${wholeChar[playerName][name]["stats"][stat]}`;} else {alert("Need to select Character first before rolling.");}}
    else{diceMod.innerHTML = `${toTitleCase(stat)}: +0`;}
}

function generateSheets(sheetLocation, sharedLocation, mode)
{
    for(let sheet of Object.keys(wholeChar[player]))
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
                let button = document.createElement("button");
                button.innerHTML = toTitleCase(sharedSheet); 
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
        name = toTitleCase(htmlInfo[1]);
        playerName = toTitleCase(htmlInfo[0]);

        setDoc(`playerChar/${player}/shared`, true);
        setDoc(`playerChar/${player}/sharedSheets/${name}`, {"name" : name, "playerName" : playerName});
        handleShowSheet(playerName, name);
    }

    for(let diceSelect of document.getElementsByClassName("diceSelect")){diceSelect.onclick = handleDiceSelect;}
    rollDiceBtn = document.getElementById("rollDice").onclick = handleDiceRoll;
}

/**
 * Once the roll dice button is clicked
 */
function handleDiceRoll()
{
    let modifier = document.getElementById("diceMod").innerHTML;
    modifier = modifier.split(": ");

    switch(document.getElementsByClassName("selected-dice")[0].innerHTML)
    {
        case "Basic":
            let amount = parseInt(document.getElementById("diceToRoll").value);
            let dice = parseInt(document.getElementById("sides").value);
            modifier = parseInt(document.getElementById("modifier").value);
        
            if(!Number.isNaN(amount) && !Number.isNaN(dice) && !Number.isNaN(modifier)) //If all three values are given
            {
                sendDiscordMessage(diceRoller(amount, dice, modifier, "discord") + "."); //Rolls the dice given and send the result to discord
            }

            else{alert("Need input in all 3 inputs.");} //If one or more of the values are missed
        break;

        case "Saves":
            if(modifier[0] == "InfusedRate")
            {
                let dc = parseInt(modifier[1]);
                let roll = diceRoller("1", "100", "0");
                roll = roll.slice(roll.indexOf("**") + 2);
                roll = roll.slice(0, roll.indexOf("**"));
                alert(roll);
                roll = parseInt(roll);

                if(roll <= dc)
                {
                    sendDiscordMessage(`${name} has failed their infusion save, with a roll of ${roll}, needed at least ${dc}.`);
                }

                else
                {
                    sendDiscordMessage(`${name} has succeeded their infusion save, with a roll of ${roll}, got above ${dc}.`);
                }
                break;
            }
    
        default:
            alert(`${diceRoller("1", "20", modifier[1], "discord")} on their ${modifier[0]}.`);
            break;
    }
}

/**
 * Rolls number of base dice with no modifier
 * @param {*} amount 
 * @param {*} dice 
 * @returns 
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
 * Rolls the amount of dice * d(dice) + modifier. If description is needed ifName is true
 * @param {*} amount 
 * @param {*} dice 
 * @param {*} modifier 
 * @param {*} ifName 
 * @returns 
 */
function diceRoller(amount, dice, modifier, ifName)
{
    let rolls = basicRoll(amount, dice); //rolls each die
    let sum = 0;
    let inspo = false;
    let viewMod = `${modifier}`;
    if(modifier >= 0 && !viewMod.includes("+")){viewMod = "+" + modifier;} //Adds the + if the modifier is positive
    let message = ""; 
    if(ifName == "discord"){message = `${name} rolled `;} //Creates the message for discord
    message += ` *${amount}d${dice}${viewMod}* : *(`;
    
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

    message += `)${viewMod}=* **${finalResult}** `;

    if(ifName == "finalResult"){message = `${finalResult}`;}

    return message;
}

function handleDeleteBtn()
{
    let display = document.getElementById("createNew");
    let shared = document.createElement("div");

    shared.id = "sharedDelete";
    display.innerHTML = `<h3>Delete Who?</h3>`;
    display.parentElement.appendChild(shared);

    generateSheets("createNew", "sharedDelete", "delete");
}

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

function handleCreateNewSheet()
{
    let display = document.getElementById("createNew");

    display.innerHTML = 
    `
        <h6 style="display: inline; margin: 5px;" class = "color-UP-yellow">Character's Name:</h6><input style="display: inline;" id="name"/>
        <button id="done">Create!</button>
    `;
    document.getElementById("done").onclick = createNewSheet;
}

function createNewSheet()
{
    let name = document.getElementById("name");
    if(name.value != ""){setDoc(`playerChar/${player}/${name.value}/stats`, {"name":name.value}); document.getElementById("createNew").innerHTML = "";}
    else{alert("Need to give a character name.");}
}

function handleShowSheet(playerName, name)
{
    let div = document.getElementById("sheet");
    div.innerHTML = "";
    setDoc(`playerChar/${player}/currentSheet`, `${playerName}-${name}`);

    div.innerHTML = 
    `
    <div id="frame" draggable="false">
        <iframe id="statSheet" src="stats.html?${name}-${playerName}" title="stats" style="-webkit-text-size-adjust: none; transform-origin:left top;" draggable="false"></iframe>
    </div>
    `; 

    document.title = `${name}'s Sheet`;

    if(wholeChar[player]["zoomSheetLevel"])
    {
        document.getElementById("statSheet").style.transform = `scale(${wholeChar[player]["zoomSheetLevel"]/100})`;
        document.getElementById("statSheet").style.width = `${100/(wholeChar[player]["zoomSheetLevel"]/100)}%`;
        document.getElementById("statSheet").style.marginBottom = `${((wholeChar[player]["zoomSheetLevel"]/100)-1)*70*9.4}px`;
        document.getElementById("statSheet").style.height = `${((100/wholeChar[player]["zoomSheetLevel"]))*125}vh`;
    }
}

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
