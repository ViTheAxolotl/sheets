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
        window.location.href = "loginPage.html?index.html"; 
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

    for(let sheet of Object.keys(wholeChar[player]))
    {
        if(["currentSheet", "zoomSheetLevel", "shared"]){continue;}
        let button = document.createElement("button");
        button.innerHTML = sheet; 
        button.onclick = handleShowSheet;
        button.classList = "gridButton";
        document.getElementById("sheets").appendChild(button);
    }

    let deleteBtn = document.createElement("img");
    deleteBtn.src = "images/trashIcon.png";
    deleteBtn.style.display = "block";
    deleteBtn.style.margin = "10px auto";
    deleteBtn.onclick = handleDeleteBtn;
    document.getElementById("sheets").appendChild(deleteBtn);
}

function init()
{
    document.getElementById("addButton").onclick = handleCreateNewSheet;
    let buttons = document.getElementsByClassName("inOrDe");
    for(let button of buttons){button.onclick = handleButton;}

    if(htmlInfo.includes("?"))
    {
        let button;
        htmlInfo = htmlInfo.split("?");
        htmlInfo = htmlInfo[1];
        htmlInfo = htmlInfo.split("-");
        name = htmlInfo[1];
        playerName = htmlInfo[0];

        setDoc(`playerChar/${player}/shared`, true);
        button = document.createElement("button");
        button.onclick = handleShowSheet;
        button.innerHTML = name;
        button.click();
    }
}

function handleDeleteBtn()
{
    let display = document.getElementById("createNew");

    display.innerHTML = 
    `
        <h3>Delete Who?</h3>
    `;

    for(let sheet of Object.keys(wholeChar[player]))
    {
        if(sheet == "currentSheet"){continue;}
        let button = document.createElement("button");
        button.innerHTML = sheet; 
        button.onclick = deleteSheet;
        button.classList = "gridButton";
        display.appendChild(button);
    }
}

function deleteSheet()
{
    deleteDoc(`playerChar/${player}/currentSheet`);
    deleteDoc(`playerChar/${player}/${this.innerHTML}`);
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

function handleShowSheet()
{
    if(!wholeChar[player]["shared"])
    {
        playerName = player;
        name = this.innerHTML;
    }

    let div = document.getElementById("sheet");
    div.innerHTML = "";
    setDoc(`playerChar/${player}/currentSheet`, `${playerName}-${name}`);

    div.innerHTML = 
    `
    <div id="frame" draggable="false">
        <iframe id="statSheet" src="stats.html?${this.innerHTML}-${playerName}" title="stats" style="-webkit-text-size-adjust: none; transform-origin:left top;" draggable="false"></iframe>
    </div>
    `; 

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
