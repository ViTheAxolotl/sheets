/**
 * viMethods.js — the shared toolbox for the Sheets site. Every other script imports from here.
 *
 *   • Connects to Sheets' own Firebase project (separate from the Infused / one-shot
 *     campaign sites) and exports `auth`, `database` and `storage`.
 *   • setDoc / deleteDoc: the one way the site writes to the database.
 *   • passwordReset: emails a password-reset link (Sheets uses real email accounts).
 *   • Small helpers: toTitleCase, statFormat (+3 / -1), reload, createCard, etc.
 *
 * Data layout: playerChar/<Account>/<Character>/ holds each sheet
 * (stats, image, presets...), and playerChar/<Account>/ also keeps
 * currentSheet, zoomSheetLevel and sharedSheets.
 *
 * Note: the Firebase config below is meant to be public (all web apps ship it);
 * what protects the data is the database's security rules, not this key.
 */

"use strict";
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { getAuth, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { getStorage, uploadBytes, getDownloadURL, ref as sRef } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Firebase project settings. Every page that imports this file shares this one connection.
const firebaseApp = initializeApp
({
    apiKey: "AIzaSyCbXEHrEWp-WEKriotvpeD7AQq2k-rCluE",
    authDomain: "sheets-fd946.firebaseapp.com",
    databaseURL: "https://sheets-fd946-default-rtdb.firebaseio.com",
    projectId: "sheets-fd946",
    storageBucket: "sheets-fd946.firebasestorage.app",
    messagingSenderId: "1088842294165",
    appId: "1:1088842294165:web:02ce4992c44d04ab378c9c",
    measurementId: "G-FSL9K4SQ84",
    storageBucket: "gs://sheets-fd946.firebasestorage.app"
}); //Connects to database

export let auth = getAuth(); //Logs into accounts
export let database = getDatabase(); //Sets up connection
export let storage = getStorage(firebaseApp);
export let quickAction = false;
// Which ability score each skill uses (e.g. stealth -> Dexterity). Used when working out skill bonuses.
export let skillDecrypt = {"athletics" : "Strength", "acrobatics" : "Dexterity", "slightOfHand" : "Dexterity", "stealth" : "Dexterity", "arcana" : "Intelligence", "history" : "Intelligence", "investigation" : "Intelligence", "nature" : "Intelligence", "religion" : "Intelligence", "animalHandling" : "Wisdom", "insight" : "Wisdom", "medicine" : "Wisdom", "perception" : "Wisdom", "survival" : "Wisdom",  "deception" : "Charisma",  "intimidation" : "Charisma",  "performance" : "Charisma",  "persuasion" : "Charisma"};

/**
 * Uploads a picture the player picked: compresses it (max ~0.4 MB, 1024px) in the
 * browser, stores it in Firebase Storage at `structure`, and saves the public link.
 * For type "portrait" it's saved as playerChar/<player>/<charName>/image and shown at once.
 */
export async function handleImageUpload(event, structure, type, player, charName)
{
    if(event.target.files)
    {
        let imageFile = event.target.files[0];
        
        const options = {
            maxSizeMB: 0.4,          // Max size 200KB (Perfect for tokens/sheets)
            maxWidthOrHeight: 1024, // Keeps it crisp but not massive
            useWebWorker: true
        };

        try {
            console.log("Compressing...");
            const compressedFile = await imageCompression(imageFile, options);
            
            // --- STEP 2: UPLOAD TO STORAGE ---
            // Saving it as the player's name ensures they only ever have ONE file (saves space)
            const storageRef = sRef(storage, structure);
            
            const snapshot = await uploadBytes(storageRef, compressedFile);
            
            // --- STEP 3: GET THE PERMANENT URL ---
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            // --- STEP 4: UPDATE FIREBASE REALTIME DB ---
            // This ensures the "Source of Truth" is updated for everyone
            switch(type)
            {
                case "portrait":
                    setDoc(`playerChar/${player}/${charName}/image`, downloadURL);
                    document.getElementById("portrait").src = downloadURL;
                    document.getElementById("portrait").style.display = "block";
                    break;
            }
        } 
        
        catch (error) 
        {
            alert("Upload failed:", error);
        }
    }
}

/**
 * Asks Firebase to email a password-reset link to `email`, then reports whether it worked.
 */
export async function passwordReset(email)
{
    try 
    {
        await sendPasswordResetEmail(auth, email);
        alert("Email sent successfully, Check inbox & Spam for next steps!");
    } 
    
    catch (error) 
    {
        alert(`Error: ${error.message}`);
    }
}

/**
 * Turns "quick action" mode on or off. In that mode createCard() makes compact buttons
 * instead of full parchment cards (used by the Quick Action overlay).
 */
export function setQuickAction(bool)
{
    quickAction = bool;
}

/**
 * Works out where each grid square is, in pixels, on the battle map.
 * The map image is 26×26 squares (A–Z down, 1–26 across). `pos[i]` is the pixel offset
 * of column/row i. The "bumper" and "movement" numbers were tuned by hand for each
 * Bootstrap screen-size breakpoint so tokens land exactly on the squares.
 * Returns everything in one object, used by map.js and mapControler.js.
 */
export function setMapValue()
{
    const body = document.querySelector("body"); //gridMap
    const rect = body.getBoundingClientRect();
    let trueMapSize = 2030;
    let mapSize = (trueMapSize * (8 / 10));
    let bumper = Math.round(trueMapSize / 26) * 0.011;
    let distance = Math.round(mapSize / 26);
    let movement = distance * 1.18999999999999999;
    let bubble = 35;

    if(screen.width < 576)
    {
        bumper = Math.round(trueMapSize / 26) * 0.149;
        movement = distance * 1.290059;
    }

    else if(screen.width < 768)
    {
        bumper = Math.round(trueMapSize / 26) * 0.139999;
        movement = distance * 1.290319999;
    }
 
    else if(screen.width < 992)
    {
        bumper = Math.round(trueMapSize / 26) * 0.1299999;
        movement = distance * 1.2899999;
    }

    else if(screen.width < 1200)
    {
        bumper = Math.round(trueMapSize / 26) * 0.04244;
        movement = distance * 1.1799;
    }

    else if(screen.width < 1400)
    {
        bumper = Math.round(trueMapSize / 26) * 0.04235;
        movement = distance * 1.1933183;
    }

    let disAndBum = distance + bumper;
    disAndBum = parseInt(disAndBum);
    movement = parseInt(movement);
    let pos = [disAndBum, disAndBum + movement, disAndBum + (movement * 2), disAndBum + (movement * 3), disAndBum + (movement * 4), disAndBum + (movement * 5), disAndBum + (movement * 6), disAndBum + (movement * 7), disAndBum + (movement * 8), disAndBum + (movement * 9), disAndBum + (movement * 10), disAndBum + (movement * 11), disAndBum + (movement * 12), disAndBum + (movement * 13), disAndBum + (movement * 14), disAndBum + (movement * 15), disAndBum + (movement * 16), disAndBum + (movement * 17), disAndBum + (movement * 18), disAndBum + (movement * 19), disAndBum + (movement * 20), disAndBum + (movement * 21), disAndBum + (movement * 22), disAndBum + (movement * 23), disAndBum + (movement * 24), disAndBum + (movement * 25)];
    let yPos = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let xPos = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26"];
    
    let map = {"trueMapSize" : trueMapSize, "mapSize" : mapSize, "bumper" : bumper, "distance" : distance, "movement" : movement, "disAndBum" : disAndBum, "pos" : pos, "xPos" : xPos, "yPos" : yPos, "bubble" : bubble};
    return map;
}

/**
 * Capitalises the first letter of every word: "help me" -> "Help Me".
 * Used wherever names are shown, since many are typed or stored in lower case.
 */
export function toTitleCase(word)
{
    let finalWord = "";
    if(word.includes(" ")) //More than one word
    {
        word = word.split(" "); 
        for(let singleWord of word)
        {
            finalWord += `${singleWord[0].toUpperCase() + singleWord.slice(1)} `; //Capitilize each word in the varible
        }
        finalWord = finalWord.slice(0, finalWord.length - 1);
    }

    else //If only one word given
    {
        finalWord = word[0].toUpperCase() + word.slice(1); //Caps the one word
    }

    return finalWord;
}

/**
 * Builds a card and adds it to the element with id `location`.
 *   title: card heading
 *   text:  array of lines; each becomes its own paragraph
 * Normally a parchment card ("card notes"); in quick-action mode a small button instead.
 */
export function createCard(title, text, location)
{
    if(!quickAction)
    {   
        let cardDiv = document.createElement("div");
        cardDiv.setAttribute("class", "card notes");
        let cardBody = document.createElement("div");
        cardBody.setAttribute("class", "card-body notes");
        let cardTitle = document.createElement("h5");
        cardTitle.setAttribute("class", "card-title");
        cardTitle.innerHTML = title;
        cardBody.appendChild(cardTitle);

        for(let i = 0; i < text.length; i++) //For each sentence in the card
        {
            let cardText = document.createElement("p");
            cardText.setAttribute("class", "card-text");
            cardText.style.margin = "3px";
            cardText.innerHTML = text[i];
            cardBody.appendChild(cardText);
        }
        
        let noteDisplay = document.getElementById(location);
        noteDisplay.appendChild(cardDiv);
        cardDiv.appendChild(cardBody);
    }
    
    else
    {
        let card = document.createElement("button");
        card.classList = "center gridButton card-body text-brass bg-oak";
        card.innerHTML = title;

        let noteDisplay = document.getElementById(location);
        noteDisplay.appendChild(card); 
    }
}

/**
 * Writes `toChange` to the database at `path`, replacing whatever was there.
 * Every save on the site goes through here (e.g. setDoc("currentMap/Ben/currentHp", "12")).
 */
export function setDoc(path, toChange)
{
    set(ref(database, path), toChange); 
}

/**
 * Deletes whatever is stored at `path` in the database (by setting it to null).
 */
export function deleteDoc(path)
{
    set(ref(database, path), null);
}

/**
 * Picks the little health-bar picture shown under a token.
 * Temp HP shows its own bar; otherwise the bar steps down at 100%, 80%, 60%, 40%, above 0 and 0.
 * Max and current both "0" means "don't show a bar" (used for objects).
 */
export function returnHpImage(maxHp, tempHp, currentHp)
{
    let fraction = parseInt(currentHp) / parseInt(maxHp);

    if(tempHp != null)
    {
        if(tempHp != "0")
        {
            return "images/map/hpBar/tempHp.png";
        }
    }

    if(maxHp == "0" && currentHp == "0")
    {
        return "images/map/hpBar/invisible.png";
    }

    else if(fraction == 1)
    {
        return "images/map/hpBar/hpBar1.png";
    }

    else if(fraction >= .8)
    {
        return "images/map/hpBar/hpBar2.png";
    }

    else if(fraction >= .6)
    {
        return "images/map/hpBar/hpBar3.png";
    }

    else if(fraction >= .4)
    {
        return "images/map/hpBar/hpBar4.png";
    }

    else if(fraction > 0)
    {
        return "images/map/hpBar/hpBar5.png";
    }

    else if(fraction == 0)
    {
        return "images/map/hpBar/hpBar6.png";
    }  
}

/**
 * Basic safety check on text typed by players before it's used to build page content.
 * Removes spaces, swaps double quotes/backticks for single quotes, and rejects (returns null,
 * with an alert) anything containing < > ; @ ( ).
 */
export function clenseInput(toClense)
{
    let badChars = ["<", ">", ";", "(", ")"];
    let isOk = true;

    toClense = toClense.replaceAll(" ", "");
    toClense = toClense.replaceAll("\"", "\'");
    toClense = toClense.replaceAll("\`", "\'");

    for(let bad of badChars)
    {
        if(toClense.includes(bad)) //If the input contains a bad char
        {
            alert(`Bad char detected: ${bad}. Please remove the char and try again.`);
            isOk = false;
        }
    }

    if(isOk)
    {
        return toClense;
    }

    else
    {
        return null;
    }
}

/**
 * Shows a modifier the D&D way: 3 -> "+3", 0 -> "+0", -1 -> "-1".
 */
export function statFormat(stat)
{
    stat = parseInt(stat);

    if(stat >= 0)
    {
        return "+" + stat;
    }

    else
    {
        return `${stat}`;
    }
}

/**
 * Reloads the page after `seconds` seconds (lets a database write finish first).
 */
export function reload(seconds)
{
    setTimeout(function(){location.reload();}, 1000 * seconds);
}

/**
 * Inserts `elemToPlace` into the page directly before `referenceElement`.
 */
export function placeBefore(elemToPlace, referenceElement)
{ 
    referenceElement.parentElement.insertBefore(elemToPlace, referenceElement);
}

/**
 * Makes a small inline "Name:" label (an <h6>) for building forms in code.
 */
export function createLabel(name)
{
    let label = document.createElement("h6");
    label.innerHTML = `${name}:`;
    label.style.display = "inline";
    label.classList = "text-brass";
    return label;
}