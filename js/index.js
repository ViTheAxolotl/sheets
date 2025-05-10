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
    document.getElementById("sheets").innerHTML - "";

    for(let sheet of Object.keys(wholeChar[player]["sheets"]))
    {
        let button = document.createElement("button");
        button.innerHTML = sheet; 
        button.onclick = handleShowSheet;
        button.classList = "gridButton";
        document.getElementById("sheets").appendChild(button);
    }
}

function init()
{
    document.getElementById("addButton").onclick = handleCreateNewSheet;
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
    if(name.value != ""){setDoc(`playerChar/${player}/sheets/${name.value}`, {"name":name.value}); document.getElementById("createNew").innerHTML = "";}
    else{alert("Need to give a character name.");}
}

function handleShowSheet()
{
    let div = document.getElementById("controls");
    div.innerHTML = "";
    setDoc(`playerChar/${player}/currentSheet`, this.innerHTML);

    div.innerHTML = 
    `
    <div id = "sheet" style="display: none;" draggable="false">
        <iframe id="statSheet" src="stats.html?${this.innerHTML}" title="stats" style="height: 90vh; margin: 5px;" draggable="false"></iframe>
    </div>
    `; 
}