// Nur tatsächlich mitgelieferte Dateien. Neue Verbandsdateien nach Prüfung
// von Fassung und Weitergabefreigabe hier registrieren, nicht fremde URLs proxyen.
export const DOKUMENT_DOWNLOADS = Object.freeze([
  Object.freeze({ pfad: "/dokumente/hausregeltest-1-2026-2027.pdf", titel: "Hausregeltest 1 · 2026/2027" }),
]);

export function lokalerDokumentDownload(wert) {
  return typeof wert === "string" && DOKUMENT_DOWNLOADS.some(d => d.pfad === wert.trim()) ? wert.trim() : "";
}

const sicher = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const webLink = wert => {
  try { return ["https:","http:"].includes(new URL(wert, "https://vereinsseite.invalid/").protocol) ? wert : ""; } catch { return ""; }
};

export function dokumentZeile(d, h) {
  const download = lokalerDokumentDownload(d.datei);
  const quelle = webLink(d.href);
  if (!quelle) return "";
  const primaer = download
    ? `<a class="dokument-download" href="${sicher(download)}" download>Herunterladen</a>`
    : `<a href="${sicher(quelle)}"${h.extern ? ' target="_blank" rel="noopener noreferrer"' : ""}>${h.extern ? "Beim Verband öffnen" : "Öffnen"}</a>`;
  return `<article class="lz dokument-zeile">
    <span class="lz-marke ${sicher(h.symbol)}" aria-hidden="true"></span>
    <div class="lz-text">
      <h3 class="lz-titel">${sicher(d.titel)}</h3>
      <p class="lz-sub">${sicher(d.sub)}</p>
      ${d.stand ? `<p class="lz-sub">Stand: ${sicher(d.stand)}</p>` : ""}
      <div class="dokument-aktionen">${primaer}${download ? `<a class="dokument-quelle" href="${sicher(quelle)}" target="_blank" rel="noopener noreferrer">Quelle: ${sicher(h.text)}</a>` : ""}</div>
    </div>
    <span class="abzeichen ${sicher(h.klasse)}">${sicher(h.text)}</span>
  </article>`;
}
