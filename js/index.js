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
