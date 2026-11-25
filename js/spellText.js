/**
 * spellText.js — turns a pasted spell (from a book, D&D Beyond or similar) into the sites'
 * spell format, with the dashboard's roll codes added. Used by the sheet's "+ New Spell".
 * The same converter as the D&D site's src/statBlock.js (keep the two in step).
 */

/* ------------------------------------------------------------------------------------ *
 *  Pasted spells: text copied from a book, D&D Beyond or similar -> the sites' spell    *
 *  format (castTime, range, components, duration, concentration, description), with    *
 *  the dashboard's roll codes added. Used by "+ New Spell" on the sheet.            *
 * ------------------------------------------------------------------------------------ */

const SPELL_LABELS = {
    "casting time": "castTime", "range": "range", "range/area": "range", "components": "components",
    "duration": "duration", "level": "level", "school": "school",
};
//Lines from here on are about the spell, not part of it (class lists, sources, tags)
const SPELL_END = /^(classes|subclasses|feats|source|spell lists?|available for|(?:spell )?tags|backgrounds|races|species|optional\/variant classes)\b\s*[:.]?/i;
const LEVEL_WORDS = {cantrip: "0", "1st": "1", "2nd": "2", "3rd": "3", "4th": "4", "5th": "5", "6th": "6", "7th": "7", "8th": "8", "9th": "9"};

/** "[Cylinder](https://...)" -> "Cylinder", **bold** -> bold, and nothing that could run as HTML. */
function cleanPasted(text)
{
    return String(text ?? "")
        .replace(/\r/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\*\*|__/g, "")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/[  ]+/g, " ");
}

/** The level from "Level 4", "4th-level", "4th level evocation", "Evocation cantrip"... ("" if none) */
function levelFrom(text)
{
    let t = String(text ?? "").toLowerCase();
    let m = t.match(/\blevel\s*(\d)\b/) ?? t.match(/\b(\d)(?:st|nd|rd|th)[- ]level\b/) ?? t.match(/^\s*(\d)(?:st|nd|rd|th)?\s*$/);
    if(m){return m[1];}
    if(/\bcantrip\b/.test(t)){return "0";}
    return "";
}

/** "Action" -> "1 Action", "Bonus Action" -> "1 Bonus Action" (the way spells.json writes them) */
function castTimeText(value)
{
    let v = value.trim();
    if(/^(bonus action|action|reaction)\b/i.test(v)){v = `1 ${v}`;}
    return v.replace(/\b\w/, (c) => c.toUpperCase());
}

/** "V, S, M (a ruby worth 50 gp)" -> "v, s, m: a ruby worth 50 gp" */
function componentsText(value)
{
    let material = value.match(/\bM\s*\(([^)]*)\)/i);
    let letters = value.replace(/\(.*\)/, "").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
    return letters.map((c) => c == "m" && material ? `m: ${material[1].trim().replace(/^./, (x) => x.toLowerCase())}` : c).join(", ");
}

/**
 * Adds the dashboard's roll codes to a spell's text, the way the hand-written spells use them:
 *   spell attack -> {@damage 2d10}, saving throw -> {@save 8d6} (no damage: "saving throw {@save}"),
 *   healing -> {@damage 1d8+$spellBonus$}, upcasting -> {@scaledamage 8d6|3-9|1d6}
 */
export function codeSpellText(desc, higher, level)
{
    let attack = /\bspell attack\b/i.test(desc);
    let save = /\bsaving throw\b/i.test(desc);
    let healing = !attack && !save && /regains?\b[^.]*hit points/i.test(desc);
    let code = attack ? "@damage" : save ? "@save" : healing ? "@damage" : null;
    let base = null;

    if(code)
    {
        let found = desc.match(/(\d+d\d+)(\s*\+\s*your spellcasting (?:ability )?modifier)?/i);
        if(found)
        {
            base = found[1] + (found[2] ? "+$spellBonus$" : "");
            desc = desc.replace(found[0], `{${code} ${base}}`);
        }
        else if(code == "@save"){desc = desc.replace(/saving throws?\b/i, (words) => `${words} {@save}`);}
    }

    let lvl = parseInt(level) || 0;
    if(higher && base && lvl > 0)
    {
        let step = higher.match(/(?:increases?|heals?) by (\d+d\d+)(?=[^.]*for (?:each|every) (?:spell )?slot level above)/i);
        if(step){higher = higher.replace(step[1], `{@scaledamage ${base}|${lvl}-9|${step[1]}}`);}
    }

    return higher ? `${desc}\n${higher}` : desc;
}

/**
 * Sorts a pasted spell. Works with "Label: value" lines (5e books, most sites) and with the
 * label on one line and its value on the next (D&D Beyond). Anything it can't tell is left
 * blank for the form. Returns {name, level, castTime, range, components, duration,
 * concentration, description, school}.
 */
export function parseSpellText(raw)
{
    let lines = cleanPasted(raw).split("\n").map((l) => l.trim());
    let out = {name: "", level: "", school: "", castTime: "", range: "", components: "", duration: "", concentration: "false"};
    let body = [];
    let higher = "";
    let i = 0;

    while(i < lines.length && lines[i] == ""){i++;}

    //First line: the name, often with "Level 4 Evocation" / "4th-level evocation" on the end
    if(i < lines.length)
    {
        let first = lines[i++];
        let m = first.match(/^(.*?)\s+((?:level\s*\d|\d(?:st|nd|rd|th)[- ]level|\w+\s+cantrip|cantrip)\b.*)$/i);
        if(m){out.name = m[1].trim(); out.level = levelFrom(m[2]); out.school = m[2].replace(/level\s*\d|\d(?:st|nd|rd|th)[- ]level|cantrip/i, "").trim();}
        else{out.name = first;}
    }

    for(; i < lines.length; i++)
    {
        let line = lines[i];
        if(SPELL_END.test(line)){break;}

        //"Casting Time: Action", or "CASTING TIME" with the value on the next line
        let keyed = line.match(/^([A-Za-z /]+?)\s*:\s*(.*)$/);
        let label = (keyed ? keyed[1] : line).trim().toLowerCase();
        if(SPELL_LABELS[label] && body.length == 0)
        {
            let value = keyed ? keyed[2] : "";
            if(value == "" && lines[i + 1] && !SPELL_LABELS[lines[i + 1].toLowerCase().replace(/:$/, "")]){value = lines[++i];}
            out[SPELL_LABELS[label]] = value.trim();
            continue;
        }

        //Level / school on its own line ("4th-level evocation", "Level 4 Evocation")
        if(!out.level && body.length == 0 && levelFrom(line) !== "" && line.length < 40){out.level = levelFrom(line); continue;}

        //Upcasting paragraph
        let up = line.match(/^(?:at higher levels|using a higher-level spell slot|cantrip upgrade)\s*[.:]\s*(.*)$/i);
        if(up){higher = up[1]; continue;}

        //Table rows (tab-separated) become bullet points
        if(line.includes("\t")){body.push(`{@Choice} ${line.split("\t").map((c) => c.trim()).filter(Boolean).join(" | ")}`); continue;}

        if(line == ""){continue;}
        body.push(line);
    }

    //Duration: "Concentration, up to 1 minute" -> concentration + "Up to 1 minute"
    if(/concentration/i.test(out.duration))
    {
        out.concentration = "true";
        out.duration = out.duration.replace(/concentration\s*,?\s*/i, "").replace(/^./, (c) => c.toUpperCase());
    }

    if(/\D/.test(out.level)){out.level = levelFrom(out.level);} //"4th" from a LEVEL line
    out.castTime = castTimeText(out.castTime);
    out.components = componentsText(out.components);
    out.description = codeSpellText(body.join("\n"), higher, out.level);
    return out;
}
