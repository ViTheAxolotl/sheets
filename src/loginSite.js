/**
 * loginSite.js — log in, create an account, or reset a password (loginPage.html).
 *
 * Sheets uses real email accounts. Passwords shorter than 6 characters are padded with
 * "." (Firebase's minimum), and both email and password are cleaned and title-cased the
 * same way at sign-up and log-in so they always match.
 *
 * Pages that need a login send people here as loginPage.html?|<page to return to>;
 * after logging in they're sent back to that page.
 */

"use strict";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, clenseInput, reload, passwordReset, popupAlert, popupPrompt } from '../js/viMethods.js';

let url = window.location.href.split("/");
let player;
let username, password, backBtn, loginBtn;
let mode = "login";

/**
 * Hooks up Enter, Back, Create New Account and Reset Password.
 */
function init()
{
    username = document.getElementById("username");
    password = document.getElementById("password");
    
    backBtn = document.getElementById("back");
    backBtn.onclick = handleBackBtn;
    loginBtn = document.getElementById("submit");
    loginBtn.onclick = handleLoginBtn;

    document.getElementById("createNew").onclick = handleCreateNew;
    document.getElementById("resetPassword").onclick = handlePasswordReset;
}

/**
 * Asks for the account's email (until it contains an @) and sends a reset link.
 */
async function handlePasswordReset()
{
    let message = "Enter your account's email address and we'll send you a reset link.";
    let email = "";

    while(true)
    {
        email = await popupPrompt(message, {title: "Reset password", value: email, placeholder: "you@example.com", ok: "Send"});
        if(email == null){return;} //Cancelled
        email = email.trim();
        if(email.includes("@")){break;}
        message = "That doesn't look like an email address. Try again:";
    }

    passwordReset(email);
}

/**
 * Enter. In login mode, logs in. In create mode, checks both passwords match and
 * creates the account, then returns to the page they came from.
 */
function handleLoginBtn()
{
    let user = username.value;
    let pass = password.value;

    // Firebase needs at least 6 characters, so short passwords are padded with ".".
    if(pass.length < 6)
    {
        for(let i = pass.length; i < 6; i++)
        {
            pass = pass + ".";
        }
    }

    if(mode == "login")
    {
        login(toTitleCase(clenseInput(user)), toTitleCase(clenseInput(pass)));
    }

    else
    {
        let conf = document.getElementById("confirmPassword").value;

        if(conf.length < 6)
        {
            for(let i = conf.length; i < 6; i++)
            {
                conf = conf + ".";
            }
        }
        
        if(pass == conf)
        {
            createUserWithEmailAndPassword(auth, toTitleCase(clenseInput(user)), toTitleCase(clenseInput(pass))).then((userCredential) => {popupAlert("Your account is ready.", "Success").then(handleBackBtn);}).catch((error) => 
            {
                const errorCode = error.code;
                const errorMessage = error.message;
                popupAlert(`The account couldn't be created (${errorCode}): ${errorMessage}`, "Couldn't create account");
            });
        }
        
        else
        {
            popupAlert("Password and Confirm Password don't match. Please retype them carefully.");
        }
    }
}

/**
 * "Create New Account": switches the form to sign-up mode by adding a Confirm Password
 * row. Back now just reloads the login form.
 */
function handleCreateNew()
{
    let confirm = [document.createElement("h5"), document.createElement("input")];
    let tdHolders = [document.createElement("td"), document.createElement("td")];
    let trRow = document.createElement("tr");

    document.getElementById("instructions").innerHTML = "Provide the Email & Password you would like to use:";
    document.getElementById("createNew").remove();
    backBtn.onclick = function (){reload(.5);}
    mode = "create";
    
    confirm[0].innerHTML = "Confirm Password:";
    confirm[0].style.textAlign = "left";
    confirm[1].type = "password";
    confirm[1].id = "confirmPassword";
    confirm[1].placeholder = "Confirm Password";
    tdHolders[0].style.padding = "0 50px 0 0";

    tdHolders[0].appendChild(confirm[0]);
    tdHolders[1].appendChild(confirm[1]);
    trRow.appendChild(tdHolders[0]);
    trRow.appendChild(tdHolders[1]);
    document.getElementById("loginTable").appendChild(trRow);
}

/**
 * Signs in with Firebase. On success goes back to the page they came from; on failure
 * shows Firebase's error code.
 */
function login(email, password)
{
    signInWithEmailAndPassword(auth, email, password).then((userCredential) => 
    {
        // Signed in 
        let user = userCredential.user;
        user = user.email.split("@");
        player = toTitleCase(user[0]);
        handleBackBtn();

    }).catch((error) => 
    {
        const errorCode = error.code;
        const errorMessage = error.message;
        popupAlert(`${errorCode}: ${errorMessage}`, "Couldn't log in");
    });
}

/**
 * Returns to the page saved after "?|" in this page's address.
 */
function handleBackBtn()
{
    let url = window.location.href.split("?|");
    window.location.href= url[1];
}

init();