// Antworttyp-spezifische Bausteine des Duell-Players. Der Ablauf bleibt
// in duell-seite.js; hier liegen nur Medien-, Zahlen- und Icon-Darstellung.

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

export function mediumHtml(frage) {
  if (frage.medium === "bild" && frage.bild_base64) {
    return `<img class="duell-medium" src="data:${esc(frage.bild_mime || "image/jpeg")};base64,${frage.bild_base64}" alt="${esc(frage.bild_alt || "Spielsituation")}">`;
  }
  return frage.medium === "video" && frage.video_url
    ? '<div class="duell-video-halter" data-duell-video></div>' : "";
}

export function verdrahteMedium(root, frage) {
  if (frage.medium !== "video" || !frage.video_url) return;
  const halter = root.querySelector("[data-duell-video]");
  const player = globalThis.SchiriQuizVideoPlayer?.baueVideoEinbettungModal(
    frage.video_url, frage.video_start_sekunden, frage.video_end_sekunden,
    Boolean(frage.video_stumm), frage.antwort_hinweis || ""
  );
  if (halter && player) halter.replaceChildren(player);
  else if (halter) halter.innerHTML = `<a class="duell-video" href="${esc(frage.video_url)}" target="_blank" rel="noopener noreferrer">Videoausschnitt öffnen</a>`;
}

export function zahlEingabeHtml(frage) {
  const einheiten = (frage.zahl_einheiten || []).map((e) => e.einheit).filter(Boolean);
  const einheit = einheiten.length === 1
    ? `<span class="zahl-einheit-fest">${esc(einheiten[0])}</span>`
    : `<select name="einheit" class="zahl-einheit-auswahl" aria-label="Einheit">${einheiten.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join("")}</select>`;
  return `<div class="zahl-eingabe-zeile"><input name="zahl" type="text" inputmode="decimal" autocomplete="off" placeholder="Zahl" aria-label="Zahlenwert">${einheit}</div>`;
}

export function formatZahl(wert) {
  return Number.isFinite(Number(wert))
    ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(Number(wert)) : String(wert);
}

export async function erstelleDuellEntscheidungsController({ getSitzung, api, fehler, versteckeFehler, nachEntscheidung }) {
  const video = globalThis.SchiriQuizVideoPlayer?.baueVideoEinbettungModal || (() => null);
  const controller = globalThis.SchiriQuizDecisionAnswers.erstelleEntscheidungsAntworten({
    getZugang: () => ({ zugang: getSitzung()?.zugang }),
    zeigeFehler: (text) => fehler(new Error(text)), versteckeFehler,
    frageAnsicht: {
      baueBadges: () => null,
      baueFrageBild: (f) => {
        if (f.medium !== "bild" || !f.bild_base64) return null;
        const bild = document.createElement("img");
        bild.className = "duell-medium";
        bild.src = `data:${f.bild_mime || "image/jpeg"};base64,${f.bild_base64}`;
        bild.alt = f.bild_alt || "Spielsituation";
        return bild;
      },
    },
    baueVideoEinbettungModal: video, baueVorlesenButton: () => null,
    baueWarumButton: () => document.createDocumentFragment(),
    beiWochenfrageBeantwortet: () => {},
    entscheidungSenden: (f, antwort) => api.entscheidung(getSitzung().zugang, f.id, antwort),
    nachEntscheidung,
  });
  await controller.bereiteVor();
  return controller;
}
