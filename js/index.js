"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, reload, deleteDoc } from './viMethods.js';

let player;
let wholeChar = {};
let firstRun = true;
let sheets;

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
    
    if(wholeChar[player]["zoomSheetLevel"])
    {
        let sheet = document.getElementById("sheet");
        sheet.style.zoom = `${wholeChar[player]["zoomSheetLevel"]}%`; 
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
        if(sheet == "currentSheet" || sheet == "zoomSheetLevel"){continue;}
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
    let div = document.getElementById("sheet");
    div.innerHTML = "";
    setDoc(`playerChar/${player}/currentSheet`, this.innerHTML);

    div.innerHTML = 
    `
    <div id="frame" draggable="false">
        <iframe id="statSheet" src="stats.html?${this.innerHTML}" title="stats" style="height: 90vh; margin: 5px;" draggable="false"></iframe>
    </div>
    `; 
}

function handleButton()
{
    let modifier = this.innerHTML;
    let zoomLevel = 100;

    switch(this.name) //Checks case on the property of which name was clicked
    {
        case "zoomSheet":
            if(modifier == "+") //If plus button is 
            {
                if(zoomLevel < 170){zoomLevel += 10;}
            }

            else //minus button is clicked
            {
                zoomLevel -= 10;
                if (zoomLevel < 70){zoomLevel = 70;}
            }

            setDoc(`playerChar/${player}/zoomSheetLevel`, zoomLevel);
            break;
    }
}