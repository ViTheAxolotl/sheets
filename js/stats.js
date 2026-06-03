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
let wholeSpells;
let wholeActions;

fetch('https://infused.axol-apps.com/src/spells.json').then(res => res.json()).then((json) => wholeSpells = json);
fetch('https://infused.axol-apps.com/src/actions.json').then(res => res.json()).then((json) => wholeActions = json);

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

    document.getElementById("shareButton").onclick = function() {prompt(`Copy this link and give it out. Anyone with link can edit your sheet.`, `https://sheets.axol-apps.com/index.html?${sheet[0]}-${sheet[1].replaceAll(" ", "%20")}`);};

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
}

/**
 * Intercepts action text names and searches against user presets or master action tables
 * @param {string} searchName - The raw string name provided by the sheet inputs
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
                alert(`Spell/Action doesn't have the correct setup to auto-roll, please ask Vi to fix, ${activeKey}.`);
            }
        }

        else
        {
            alert(`Spell/Action doesn't have the correct setup to auto-roll, please ask Vi to fix, ${name}.`);
        }
    }
}

function handleRightClickSpellRoll(e, name)
{

}

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

function showSpell()
{
    let spellName = toTitleCase(document.getElementById(this.id.slice(0, this.id.length - 4)).value);
    let link;
    let spellLevel = this.id;

    if(spellLevel.includes("can")){spellLevel = "0";}
    else{spellLevel = spellLevel.slice(3, 4);}

    if(spellName != "")
    {
        if(wholeSpells[spellLevel][spellName])
        {
            let spell = wholeSpells[spellLevel][spellName];
            document.getElementById("spellTitle").innerHTML = spell["name"];
            document.getElementById("CT").innerHTML = `Cast Time: ${spell["castTime"]}`;
            document.getElementById("R").innerHTML = `Range: ${spell["range"]}`;
            document.getElementById("C").innerHTML = `Components: ${spell["components"]}`;
            document.getElementById("D").innerHTML = `Duration: ${spell["duration"]}`;
            if(spell["concentration"] == "true"){document.getElementById("concentration").style.display = "block";}
            else{document.getElementById("concentration").style.display = "none";}
            document.getElementById("spellText").innerHTML = spell["description"];

            document.getElementById("frame").style.display = "none";
            document.getElementById("spellCard").style.display = "flex";
        }

        else
        {
            spellName.replaceAll(" ", "%20");
            link = `https://roll20.net/compendium/dnd5e/${spellName}`;
            document.getElementById("spellLookup").src = link;

            document.getElementById("spellCard").style.display = "none";
            document.getElementById("frame").style.display = "block";
        }
        
        document.getElementById("spellFrame").classList.remove("invisible");
    }
}

function handleExit()
{
    document.getElementById("spellFrame").classList.add("invisible");
}

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

    alert(`Rolled (${roll-mod})${modifier} = ${roll} for ${toTitleCase(clicked)}.`);
    return false;
}
