// ============================================================
//  Emoji-Reaktionen im Duell-Modus - GIMMICK, kein Kernfeature (Teil F)
// ============================================================
//  Max' eigene Einordnung: ein Gimmick. Deshalb zuletzt gebaut und
//  bewusst klein gehalten - fällt diese Datei mal ganz weg, spielt sich
//  das Duell unveraendert weiter.
//
//  Zwei Ausnahmen von der sonstigen Hausregel "Woerter statt bloßer
//  Icons" gelten hier ausdruecklich (Max' Vorgabe fuer genau dieses
//  Gimmick):
//   - Die vier Reaktions-Knoepfe sind reine Emoji ohne Beschriftung
//     darunter (⚽ 👏 😮 😂), keine Zahlen.
//   - Die kurze Einblendung zeigt nur Emoji + Name, kein Fließtext.
//  Ueberall sonst auf der Duell-Seite gilt die Regel weiter.
// ============================================================

const ERLAUBTE_EMOJI = ["⚽", "👏", "😮", "😂"];

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

// Reine Funktion (testbar ohne DOM): die letzte Reaktion einer ANDEREN
// Person in einer "duell_reaktionen_fuer_frage"-Liste, oder null.
export function findeLetzteFremdeReaktion(reaktionenListe) {
  if (!Array.isArray(reaktionenListe)) return null;
  const fremde = reaktionenListe.filter((r) => !r.ist_ich);
  return fremde.length ? fremde[fremde.length - 1] : null;
}

// Reihe aus vier grossen, gut antippbaren Emoji-Knoepfen (44pt
// Trefferflaeche, siehe duell.css ".duell-reaktion-knopf"). Ruft bei
// Klick "aufReagieren(emoji)" auf - die eigentliche RPC bleibt in
// duell-seite.js.
export function baueReaktionsleiste(aufReagieren) {
  const leiste = document.createElement("div");
  leiste.className = "duell-reaktionsleiste";
  leiste.setAttribute("role", "group");
  leiste.setAttribute("aria-label", "Reagieren");
  for (const emoji of ERLAUBTE_EMOJI) {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "duell-reaktion-knopf";
    knopf.textContent = emoji;
    knopf.setAttribute("aria-label", "Mit " + emoji + " reagieren");
    knopf.addEventListener("click", () => aufReagieren(emoji));
    leiste.appendChild(knopf);
  }
  return leiste;
}

// Eine kleine, DAUERHAFTE Pille ("⚽ Lisa") - bleibt neben dem Namen im
// Vergleichsblock stehen, nachdem die kurze Einblendung verschwunden ist.
export function bauePille(reaktion) {
  const pille = document.createElement("span");
  pille.className = "duell-reaktion-pille";
  pille.textContent = `${reaktion.emoji} ${reaktion.name}`;
  return pille;
}

// Die kurze, halbtransparente Einblendung UEBER der Frage-Karte: fade in,
// kurz halten, fade out (~2,5s), dann aus dem DOM. "karte" braucht
// position:relative (siehe duell.css ".duell-frage-karte").
// prefers-reduced-motion ist bereits global in basis.css abgefangen
// (deaktiviert dort jede Animation/Transition) - hier keine eigene
// Sonderbehandlung noetig.
export function zeigeKurzeEinblendung(karte, reaktion) {
  if (!karte || !reaktion) return;
  const einblendung = document.createElement("div");
  einblendung.className = "duell-reaktion-einblendung";
  einblendung.setAttribute("aria-hidden", "true");
  einblendung.innerHTML = `<span class="duell-reaktion-einblendung-emoji">${esc(reaktion.emoji)}</span>
    <span class="duell-reaktion-einblendung-name">${esc(reaktion.name)}</span>`;
  karte.appendChild(einblendung);
  // Erst im naechsten Frame die "sichtbar"-Klasse setzen, sonst gibt es
  // keinen Uebergang von 0 auf 1 - der Browser haette dann nichts zum
  // Animieren, weil beide Zustaende im selben Tick anliegen.
  requestAnimationFrame(() => einblendung.classList.add("sichtbar"));
  setTimeout(() => einblendung.classList.remove("sichtbar"), 2200);
  setTimeout(() => einblendung.remove(), 2700);
}
