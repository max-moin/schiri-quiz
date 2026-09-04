import { DATENBANK } from "../../verein.config.js";
import { erstelleDuellZugriff } from "./duell-zugriff.js";

const root = document.getElementById("duellBereich");
const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const api = erstelleDuellZugriff(DATENBANK);
const SPEICHER = "schiriDuellSession";
let sitzung = null;
let frage = null;

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, z => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[z]));
function speichern(wert) { sitzung = wert; try { sessionStorage.setItem(SPEICHER, JSON.stringify(wert)); } catch {} }
function lesen() { try { return JSON.parse(sessionStorage.getItem(SPEICHER)); } catch { return null; } }
function fehler(error) { root.querySelector("[data-fehler]")?.remove(); root.insertAdjacentHTML("afterbegin", `<p class="duell-fehler" data-fehler>${esc(error.message)}</p>`); }

function startAnsicht() {
  const person = anmeldung?.lesen();
  const code = new URLSearchParams(location.search).get("code")?.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0,6) || "";
  root.innerHTML = `<a class="duell-zurueck" href="modus.html">← Modi</a><h1>Quiz-Duell</h1>
    <p class="duell-einstieg">Fünf frühere Wochenfragen – ohne Einfluss auf euren normalen Quizstand.</p>
    <div class="duell-start">
      <section class="duell-karte"><span class="duell-symbol">⚔️</span><h2>Neues Duell</h2><p>Du erhältst einen Code zum Teilen. Maximal drei offene Duelle.</p>
        ${person ? '<button class="duell-haupt" data-erstellen>Code erstellen</button>' : '<button class="duell-haupt" data-login>Als Vereinsmitglied anmelden</button>'}</section>
      <section class="duell-karte"><span class="duell-symbol">🔑</span><h2>Beitreten</h2><form data-beitreten>
        <label>Session-Code<input name="code" value="${esc(code)}" maxlength="6" autocomplete="off" required></label>
        ${person ? `<p>Du spielst als <strong>${esc(person.name)}</strong>.</p>` : '<label>Dein Anzeigename<input name="name" minlength="2" maxlength="30" autocomplete="nickname" required></label>'}
        <button class="duell-haupt" type="submit">Duell öffnen</button></form></section>
    </div>`;
  root.querySelector("[data-login]")?.addEventListener("click", async () => {
    const e = await loginDialog?.oeffne({ grund:"Nur angemeldete Vereinsmitglieder können einen Code erstellen.", gastErlaubt:false });
    if (e?.status === "angemeldet") startAnsicht();
  });
  root.querySelector("[data-erstellen]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try { const d = await api.erstellen(person); speichern({ code:d.code, zugang:d.zugang }); codeAnsicht(true); }
    catch (e) { event.currentTarget.disabled=false; fehler(e); }
  });
  root.querySelector("[data-beitreten]").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const knopf=event.currentTarget.querySelector("button"); knopf.disabled=true;
    try { const d=await api.beitreten(form.get("code"), person?.name || form.get("name"), person); speichern({code:d.code,zugang:d.zugang}); await laden(); }
    catch(e) { knopf.disabled=false; fehler(e); }
  });
}

function codeAnsicht(neu=false) {
  const url = `${location.origin}${location.pathname}?code=${sitzung.code}`;
  root.innerHTML = `<section class="duell-code duell-karte"><span class="duell-symbol">${neu?'🎯':'⚔️'}</span><p>Session-Code</p><strong>${esc(sitzung.code)}</strong>
    <p>Teile den Code oder den Link. Jede Person braucht nur einen Anzeigenamen.</p><div class="duell-aktionen"><button data-kopieren>Link kopieren</button><button class="duell-haupt" data-start>Jetzt spielen</button></div></section>`;
  root.querySelector("[data-kopieren]").addEventListener("click", async e => { await navigator.clipboard?.writeText(url); e.currentTarget.textContent="Kopiert ✓"; });
  root.querySelector("[data-start]").addEventListener("click", laden);
}

function mediumHtml(f) {
  if (f.medium === "bild" && f.bild_base64) return `<img class="duell-medium" src="data:${esc(f.bild_mime||'image/jpeg')};base64,${f.bild_base64}" alt="${esc(f.bild_alt||'Spielsituation')}">`;
  if (f.medium === "video" && f.video_url) return `<a class="duell-video" href="${esc(f.video_url)}" target="_blank" rel="noopener noreferrer">▶ Videoausschnitt öffnen</a>`;
  return "";
}

function frageAnsicht(f) {
  frage=f; const mehrfach=f.antworttyp === "mehrfachauswahl";
  const antworten = f.antworttyp === "freitext"
    ? '<label class="duell-freitext">Deine Entscheidung<textarea name="freitext" maxlength="400" required></textarea></label>'
    : (f.antwortoptionen||[]).filter(o=>o?.text).map(o=>`<label class="duell-option"><input type="${mehrfach?'checkbox':'radio'}" name="auswahl" value="${esc(o.schluessel)}"><span>${esc(o.text)}</span></label>`).join("");
  root.innerHTML=`<div class="duell-fortschritt"><span>Frage ${f.position} von ${f.gesamt}</span><span>Duell ${esc(sitzung.code)}</span></div><section class="duell-karte duell-frage">${mediumHtml(f)}<h1>${esc(f.frage_text)}</h1><form data-antwort>${antworten}<button class="duell-haupt" type="submit">Antwort abgeben</button></form></section>`;
  root.querySelector("[data-antwort]").addEventListener("submit", antwortenAbgeben);
}

async function antwortenAbgeben(event) {
  event.preventDefault(); const knopf=event.currentTarget.querySelector("button"); knopf.disabled=true;
  try {
    let ergebnis;
    if (frage.antworttyp === "freitext") {
      const freitext=new FormData(event.currentTarget).get("freitext")?.trim();
      const antwort=await fetch("/api/duell-freitext",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({zugang:sitzung.zugang,frageId:frage.id,freitext})});
      ergebnis=await antwort.json(); if(!antwort.ok) throw new Error(ergebnis.fehler||"Bewertung fehlgeschlagen.");
    } else {
      const auswahl=[...event.currentTarget.querySelectorAll('[name="auswahl"]:checked')].map(x=>x.value);
      if(!auswahl.length) throw new Error("Bitte wähle erst eine Antwort aus.");
      ergebnis=await api.antworten(sitzung.zugang,frage.id,auswahl);
    }
    const reaktionen=await api.reaktionen(sitzung.zugang,frage.id).catch(()=>({})); ergebnisAnsicht(ergebnis,reaktionen);
  } catch(e) { knopf.disabled=false; fehler(e); }
}

function ergebnisAnsicht(ergebnis, reaktionen) {
  const richtig=ergebnis.korrekt===true;
  const loesung=ergebnis.musterantwort || (ergebnis.richtige_texte||[]).join(" · ");
  root.innerHTML=`<section class="duell-karte duell-ergebnis ${richtig?'richtig':'falsch'}"><span class="duell-symbol">${richtig?'✓':'✕'}</span><h1>${richtig?'Richtig':'Nicht richtig'}</h1>
    ${ergebnis.feedback?`<p>${esc(ergebnis.feedback)}</p>`:""}${loesung?`<div class="duell-loesung"><b>Lösung</b><p>${esc(loesung)}</p></div>`:""}
    <div class="duell-reaktionen" aria-label="Reaktionen">${['⚽','👏','😮','😂'].map(e=>`<button data-emoji="${e}" aria-label="Mit ${e} reagieren">${e} <span>${Number(reaktionen?.[e]||0)}</span></button>`).join('')}</div>
    <button class="duell-haupt" data-weiter>Weiter</button></section>`;
  root.querySelectorAll("[data-emoji]").forEach(b=>b.addEventListener("click",async()=>{ try{ const z=await api.reagieren(sitzung.zugang,frage.id,b.dataset.emoji); root.querySelectorAll('[data-emoji]').forEach(x=>x.querySelector('span').textContent=z?.[x.dataset.emoji]||0); }catch(e){fehler(e);} }));
  root.querySelector("[data-weiter]").addEventListener("click",laden);
}

async function fertigAnsicht() {
  const stand=await api.stand(sitzung.zugang);
  root.innerHTML=`<section class="duell-karte duell-fertig"><span class="duell-symbol">🏁</span><h1>Deine fünf Fragen sind geschafft</h1><p>Asynchron heißt: Die anderen können später weiterspielen.</p>
    <div class="duell-stand">${(stand.teilnehmer||[]).map(t=>`<div><strong>${esc(t.name)}</strong><span>${t.richtig}/5 richtig · ${t.beantwortet}/5 gespielt</span></div>`).join('')}</div>
    <a class="duell-haupt" href="modus.html">Zurück zu den Modi</a></section>`;
}

async function laden() { root.innerHTML='<p class="duell-laden">Duell wird geladen …</p>'; try { const f=await api.frage(sitzung.zugang); if(f?.fertig) await fertigAnsicht(); else frageAnsicht(f); } catch(e) { speichern(null); startAnsicht(); fehler(e); } }

sitzung=lesen();
if(sitzung?.zugang) codeAnsicht(false); else startAnsicht();
