/**
 * spellEditor.js — the spell / ability editor popup: paste text and press Sort it (spellText.js
 * fills the boxes and adds the roll codes), or fill the boxes in by hand, then Save.
 * The same file is used on the D&D and Sheets sites: keep the two copies the same.
 *
 *   openSpellEditor({kind: "spell" | "ability", entry, group, title, tags, checks, help, onSave})
 *     entry   an existing spell / ability to edit (fills the boxes), or null for a new one
 *     group   its level (spells) or tag (abilities)
 *     tags    tag suggestions for abilities
 *     checks  extra tick boxes: [{id, label, checked}]
 *     help    optional HTML shown under a "Roll tags" toggle
 *     onSave  async (values, ticked) => message. values = the entry plus level / tag; ticked = {id: true/false}.
 *             Throw an Error to show a problem instead.
 *
 *   shareSpell(spell) / shareAbility(ability): save to the Worker's list, so both sites have it.
 */

import { showPopup } from './viMethods.js';
import { parseSpellText, parseAbilityText } from './spellText.js';

export const SPELL_SERVICE = "https://statblock.vitheaxolotl.workers.dev";

async function post(path, body)
{
    let response = await fetch(`${SPELL_SERVICE}${path}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    let data = await response.json().catch(() => ({}));
    if(!response.ok){throw new Error(data.error ?? `the Worker answered ${response.status}`);}
    return data;
}

/** Adds a spell to the shared list (both sites). Resolves {level, spell}. */
export function shareSpell(spell){return post("/spell", {spell});}

/** Adds an ability to the shared list (D&D site). Resolves {tag, ability}. */
export function shareAbility(ability){return post("/ability", {ability});}

const escape = (text) => String(text ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function openSpellEditor({kind = "spell", entry = null, group = "", title = "", tags = [], checks = [], help = "", onSave} = {})
{
    let isSpell = kind == "spell";
    let field = (label, input, wide) => `<label class="seField${wide ? " seWide" : ""}"><span>${label}</span>${input}</label>`;
    let tick = (id, label, checked) => `<label class="seCheck"><input type="checkbox" id="${id}"${checked ? " checked" : ""}> ${label}</label>`;
    let levels = Array.from({length: 10}, (v, lv) => `<option value="${lv}">${lv == 0 ? "Cantrip" : `Level ${lv}`}</option>`).join("");
    let thing = isSpell ? "spell" : "ability";

    let boxes = isSpell
        ? field("Name", `<input id="seName">`) +
          field("Level", `<select id="seLevel">${levels}</select>`) +
          field("Casting Time", `<input id="seCast" placeholder="1 Action">`) +
          field("Range", `<input id="seRange" placeholder="60 feet">`) +
          field("Components", `<input id="seComp" placeholder="v, s, m: a pinch of sand">`) +
          field("Duration", `<input id="seDur" placeholder="Instantaneous">`) +
          tick("seConc", "Concentration", false)
        : field("Name", `<input id="seName">`) +
          field("Tag (class, Misc, or your own)", `<input id="seTag" list="seTags" placeholder="Fighter"><datalist id="seTags">${tags.map((t) => `<option value="${escape(t)}">`).join("")}</datalist>`);

    boxes += checks.map((c) => tick(c.id, c.label, c.checked)).join("");
    boxes += field("Description (with roll codes like {@damage 2d6} or {@save 3d8})", `<textarea id="seDesc"></textarea>`, true);

    let popup = showPopup({boxClass: "popupSpellEditor", title: title || (entry?.description ? `Edit ${entry.name ?? thing}` : `New ${thing}`), dismissValue: null, buttons: [{label: "Close", value: null}], html:
        `<details class="sePasteArea"${entry?.description ? "" : " open"}>
            <summary>Paste ${isSpell ? "a spell" : "an ability"} to fill the boxes</summary>
            <textarea id="sePaste" placeholder="Paste the whole ${thing} here, starting from its name…"></textarea>
            <div class="popupButtons"><button id="seSort" class="gridButton">Sort it</button></div>
        </details>
        <div id="seForm">${boxes}</div>
        ${help ? `<details class="seHelp"><summary>Roll tags</summary><ul class="tagHelp">${help}</ul></details>` : ""}
        <p id="seStatus" class="popupMessage"></p>
        <div class="popupButtons"><button id="seSave" class="gridButton popupPrimary">Save ${thing}</button></div>`});

    //The popup is drawn on the main page
    let doc = document;
    try{if(window.top.document.getElementById("seForm")){doc = window.top.document;}}catch(e){}
    let $ = (id) => doc.getElementById(id);
    let status = (text, isError) => {$("seStatus").textContent = text; $("seStatus").classList.toggle("error", !!isError);};

    let fill = (e, g) =>
    {
        $("seName").value = e?.name ?? "";
        $("seDesc").value = e?.description ?? "";

        if(isSpell)
        {
            let level = String(g ?? e?.level ?? "");
            $("seLevel").value = /^[0-9]$/.test(level) ? level : "1";
            $("seCast").value = e?.castTime ?? "";
            $("seRange").value = e?.range ?? "";
            $("seComp").value = e?.components ?? "";
            $("seDur").value = e?.duration ?? "";
            $("seConc").checked = String(e?.concentration) == "true";
        }

        else{$("seTag").value = g ?? e?.tag ?? e?.level ?? "";}
    };

    fill(entry, group);

    $("seSort").onclick = () =>
    {
        let parsed = isSpell ? parseSpellText($("sePaste").value) : parseAbilityText($("sePaste").value);
        if(!parsed.name || !parsed.description){status(`Couldn't find a name and description. Paste the whole ${thing}, starting from its name.`, true); return;}

        let keepGroup = isSpell ? (parsed.level === "" ? $("seLevel").value : parsed.level) : (parsed.tag || $("seTag").value);
        fill(parsed, keepGroup);

        let missing = [];
        if(isSpell)
        {
            if(parsed.level === ""){missing.push("level");}
            for(let [key, label] of [["castTime", "casting time"], ["range", "range"], ["components", "components"], ["duration", "duration"]]){if(!parsed[key]){missing.push(label);}}
        }
        else if(!parsed.tag){missing.push("tag");}
        status(missing.length ? `Sorted. Couldn't find the ${missing.join(", ")}: fill ${missing.length == 1 ? "it" : "those"} in.` : "Sorted. Check the boxes, then save.", missing.length > 0);
    };

    $("seSave").onclick = async () =>
    {
        let values = isSpell
            ? {name: $("seName").value.trim(), level: $("seLevel").value, castTime: $("seCast").value.trim(), range: $("seRange").value.trim(),
               components: $("seComp").value.trim(), duration: $("seDur").value.trim(), concentration: $("seConc").checked ? "true" : "false",
               description: $("seDesc").value.trim()}
            : {name: $("seName").value.trim(), level: $("seTag").value.trim(), description: $("seDesc").value.trim()};

        if(!values.name || !values.description){status("It needs at least a name and a description.", true); return;}
        if(!isSpell && !values.level){status("Give it a tag (its class, Misc, or your own).", true); return;}
        if(/[.#$\[\]\/]/.test(values.name)){status("Names can't have . # $ [ ] or / in them.", true); return;}

        let ticked = {};
        for(let c of checks){ticked[c.id] = $(c.id).checked;}

        $("seSave").disabled = true;
        status("Saving…");

        try{status(await onSave(values, ticked) ?? "Saved.");}
        catch(error){console.error(error); status(`Couldn't save it: ${error.message}`, true);}
        finally{$("seSave").disabled = false;}
    };

    return popup;
}
