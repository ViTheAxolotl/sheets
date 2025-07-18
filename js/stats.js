"use strict";
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, statFormat, skillDecrypt, reload, deleteDoc } from './viMethods.js';

let player;
let wholeChar = {};
let stats;
let sheet; 
let firstRun = true;

const charRef = ref(database, 'playerChar/');
onValue(charRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeChar = data;

    if(firstRun)
    {
        firstRun = false;
        sheet = wholeChar[player]["currentSheet"].split("-");
        sheet[0] = toTitleCase(sheet[0]);
        sheet[1] = toTitleCase(sheet[1]);
        init();
    }
});

onAuthStateChanged(auth, (user) => 
{
    if (user) 
    {
        player = auth.currentUser.email.split("@");
        player = toTitleCase(player[0]);
    } 
});

function init()
{
    let display = document.getElementById("story");
    let stats = document.getElementsByClassName("stat");
    let viewButtons = document.getElementsByClassName("viewSpell");
    let exitBtn = document.getElementById("exitIframe");
    exitBtn.onclick = handleExit;

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
                else if(stat.id.includes("Save")){continue;}
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

        stat.onchange = updateStat;
    }

    for(let viewButton of viewButtons)
    {
        viewButton.onclick = showSpell;
        if(document.getElementById(viewButton.id.slice(0, viewButton.id.length - 4)).value == "")
        {
            viewButton.classList.add("invisible");
        }
    }

    for(let stat of document.getElementsByClassName("expertise")){stat.onclick = handleExpertise;}

    document.getElementById("shareButton").onclick = function() {alert(`Copy this link and give it out. Anyone with link can edit your sheet. \n https://vitheaxolotl.github.io/sheets/index.html?${sheet[0]}-${sheet[1]}`);};
}



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

        modifier = statFormat(modifier);
        setDoc(`playerChar/${sheet[0]}/${sheet[1]}/stats/${stat.id.slice(0, stat.id.length-4)}`, modifier);
        display.innerHTML = toTitleCase(skill + ": " + modifier);
        if(wholeChar[sheet[0]][sheet[1]]["stats"][`${exper}-expertise`]){display.innerHTML += " <strong>(Expertise)</strong>"}
    }
}

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

function updateStat()
{
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
            if(setTo[i][0] != "•" && setTo[0] != " "){setTo[i] = "•   " + setTo[i];} 
            if(setTo[i] == "•   "){setTo[i] = "";}
        }

        setTo = setTo.join("\n");

        setTo = setTo.split("    ");
 
        for(let i = 0; i < setTo.length - 1; i++)
        {
            if(setTo[i][setTo[i].length - 1] != "\n"){setTo[i] += "\n";}
        }

        setTo = setTo.join("    ");

        this.value = setTo;
        reload(1);
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
}

function showSpell()
{
    let spellName = toTitleCase(document.getElementById(this.id.slice(0, this.id.length - 4)).value);
    let link;

    if(spellName != "")
    {
        spellName.replaceAll(" ", "%20");
        link = `https://roll20.net/compendium/dnd5e/${spellName}`;
        document.getElementById("spellLookup").src = link;
        document.getElementById("spellFrame").classList.remove("invisible");
    }
}

function handleExit()
{
    document.getElementById("spellFrame").classList.add("invisible");
}