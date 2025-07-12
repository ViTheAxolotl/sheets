"use strict";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, clenseInput, reload } from '../js/viMethods.js';

let url = window.location.href.split("/");
let player;
let username, password, backBtn, loginBtn;
let mode = "login";

function init()
{
    username = document.getElementById("username");
    password = document.getElementById("password");
    
    backBtn = document.getElementById("back");
    backBtn.onclick = handleBackBtn;
    loginBtn = document.getElementById("submit");
    loginBtn.onclick = handleLoginBtn;

    document.getElementById("createNew").onclick = handleCreateNew;
}

function handleLoginBtn()
{
    let user = username.value;
    let pass = password.value;

    if(pass.length < 6)
    {
        for(let i = pass.length; i < 6; i++)
        {
            pass = pass + ".";
        }
    }

    if(mode == "login")
    {
        login(clenseInput(user), toTitleCase(clenseInput(pass)));
    }

    else
    {
        alert(document.getElementById("confirmPassword").value);
        if(pass == document.getElementById("confirmPassword").value)
        {
            createUserWithEmailAndPassword(auth, clenseInput(user), toTitleCase(clenseInput(pass))).then((userCredential) => {alert("Success, please login with the new account"); reload(2);}).catch((error) => 
            {
                const errorCode = error.code;
                const errorMessage = error.message;
                alert(`Account creation failed. Given Error ${errorCode}: ${errorMessage}..`);
            });
        }
        
        else
        {
            alert("Password and Confirm Password are not the same. Please retype carefully");
        }
    }
}

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
        alert(`Error! ${errorCode}: ${errorMessage}`);
    });
}

function handleBackBtn()
{
    let url = window.location.href.split("?");
    window.location.href= url[1];
}

init();