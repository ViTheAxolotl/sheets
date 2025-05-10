"use strict";
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, statFormat, skillDecrypt, reload, deleteDoc } from './viMethods.js';

let player;
let wholeChar = {};
let stats;
let firstRun = true;

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

    for(let stat of stats)
    {
        if(wholeChar[player]["stats"][stat.id])
        {
            if(!wholeChar[player]["stats"][stat.id]){setDoc(`wholeChar/${player}/stats/${stat.id}`, "");}
            if(typeof wholeChar[player]["stats"][stat.id] == "string")
            {
                if(stat.id == "spellBonus"){let bonus = statFormat(parseInt(wholeChar[player]["stats"][wholeChar[player]["stats"]["spellAbility"]]) + parseInt(wholeChar[player]["stats"]["proficiency"])); stat.innerHTML = bonus; setDoc(`playerChar/${player}/stats/spellBonus`, bonus);}
                else if(stat.id == "spellDC"){let dc = statFormat(parseInt(wholeChar[player]["stats"][wholeChar[player]["stats"]["spellAbility"]]) + parseInt(wholeChar[player]["stats"]["proficiency"]) + 8); stat.innerHTML = dc; setDoc(`playerChar/${player}/stats/spellDC`, dc);}
                else if(stat.id == "proficiency"){let prof = statFormat(Math.ceil(parseInt(wholeChar[player]["stats"]["lv"])/4)+1); setDoc(`playerChar/${player}/stats/proficiency`, prof); stat.innerHTML = prof;}
                else if(stat.id == "name"){stat.innerHTML = player;}
                else if(stat.id == "totalHitDice"){for(let i = 0; i < stat.length; i++){stat[i].innerHTML = `${wholeChar[player]["stats"]["lv"]}${stat[i].value}`; stat.value = wholeChar[player]["stats"][stat.id];}}
                else if(stat.id == "currentHitDice"){let max = wholeChar[player]["stats"]["totalHitDice"]; stat.innerHTML = ""; for(let i = parseInt(wholeChar[player]["stats"]["lv"]); i >= 0; i--){let option = document.createElement("option"); option.innerHTML = `${i}${max}`; option.value = `${i}`; stat.appendChild(option);} stat.value = wholeChar[player]["stats"][stat.id];}
                else if(stat.id.includes("Save")){continue;}
                else if(["spellAbility", "lv"].includes(stat.id)){stat.value = wholeChar[player]["stats"][stat.id];}
                else if(stat.value == ""){stat.value = wholeChar[player]["stats"][stat.id]; if(!["profAndLang", "infusion", "feats", "equipment"].includes(stat.id)){stat.style.minWidth = stat.value.length + 2 + "ch";}}
                else{stat.innerHTML = wholeChar[player]["stats"][stat.id];}
            }

            else
            {
                stat.checked = wholeChar[player]["stats"][stat.id];
                setStats(stat);
            }
        }

        else
        {
            setStats(stat);
        }

        stat.onchange = updateStat;
    }

    for(let stat of document.getElementsByClassName("expertise")){stat.onclick = handleExpertise;}
}

function setStats(stat)
{
    if(stat.id.includes("-btn"))
    {
        let display;
        let skill;
        let modifier;
        let exper;

        if(stat.id.includes("Save-btn"))
        {
            skill = stat.id.slice(0, stat.id.length-8);
            modifier = wholeChar[player]["stats"][skill];
            display = document.getElementById(skill + "Save");
            exper = skill + "Save";
        }

        else
        {
            skill = stat.id.slice(0, stat.id.length-4);
            let base6 = skillDecrypt[skill];
            modifier = wholeChar[player]["stats"][base6];
            display = document.getElementById(skill);
            exper = skill;
        }

        if(stat.checked)
        {
            modifier = parseInt(modifier) + parseInt(wholeChar[player]["stats"]["proficiency"]);

            if(wholeChar[player]["stats"][`${exper}-expertise`]){modifier += parseInt(wholeChar[player]["stats"]["proficiency"]);}
        } 

        modifier = statFormat(modifier);
        setDoc(`playerChar/${player}/stats/${stat.id.slice(0, stat.id.length-4)}`, modifier);
        display.innerHTML = toTitleCase(skill + ": " + modifier);
        if(wholeChar[player]["stats"][`${exper}-expertise`]){display.innerHTML += " <strong>(Expertise)</strong>"}
    }
}

function handleExpertise()
{
    let stat = this.id;
    let button = document.getElementById(stat + "-btn");

    if(button.checked)
    {
        if(wholeChar[player]["stats"][`${stat}-expertise`])
        {
            deleteDoc(`playerChar/${player}/stats/${stat}-expertise`);
        }

        else
        {
            setDoc(`playerChar/${player}/stats/${stat}-expertise`, true);
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
            if(setTo[i][0] != "•" && setTo[0] == " "){setTo[i] = "•   " + setTo[i];}
        }

        setTo = setTo.filter(item => item !== '•   ');
        setTo = setTo.join("\n");

        setTo = setTo.split("    ");
 
        for(let i = 0; i < setTo.length - 1; i++)
        {
            if(setTo[i][setTo[i].length - 1] != "\n"){setTo[i] += "\n";}
        }

        setTo = setTo.join("    ");

        this.value = setTo;
        this.style.minWidth = this.value.length + 2 + "ch";
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
        setDoc(`playerChar/${player}/stats/${this.id.slice(0, this.id.length-4)}`, smaller);
        setTimeout(init, 1000);
    }

    else if(["lv", "spellAbility", "totalHitDice"].includes(this.id)){setTimeout(init, 1000);}

    else if(["AC", "currentHp", "maxHp", "tempHp"].includes(this.id))
    {
        setDoc(`playerChar/${player}/token/${this.id}`, setTo);
        setDoc(`currentMap/${player}/${this.id}`, setTo);
        this.style.minWidth = this.value.length + 2 + "ch";
    }

    else
    {
        if(!["profAndLang", "infusion", "feats", "equipment"].includes(this.id)){this.style.minWidth = this.value.length + 2 + "ch";}
    }

    setDoc(`playerChar/${player}/stats/${this.id}`, setTo);
}
