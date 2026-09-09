const direkt = document.getElementById("installieren-direkt");
const knopf = document.getElementById("installieren-knopf");
const stand = document.getElementById("installieren-stand");
let installEreignis = null;

const eigenstaendig = window.matchMedia("(display-mode: standalone)").matches
  || window.navigator.standalone === true;

if (eigenstaendig) {
  direkt.hidden = false;
  knopf.hidden = true;
  stand.textContent = "Die Seite ist auf diesem Gerät bereits wie eine App geöffnet.";
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installEreignis = event;
  direkt.hidden = false;
  knopf.hidden = false;
  stand.textContent = "Dein Browser kann die Seite direkt installieren.";
});

knopf?.addEventListener("click", async () => {
  if (!installEreignis) return;
  knopf.disabled = true;
  await installEreignis.prompt();
  const ergebnis = await installEreignis.userChoice;
  stand.textContent = ergebnis.outcome === "accepted"
    ? "Die Website wird zum Home-Bildschirm hinzugefügt."
    : "Nicht installiert – du kannst es jederzeit erneut versuchen.";
  installEreignis = null;
  knopf.disabled = false;
  knopf.hidden = true;
});
