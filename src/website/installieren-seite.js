const direkt = document.getElementById("installieren-direkt");
const knopf = document.getElementById("installieren-knopf");
const stand = document.getElementById("installieren-stand");
let installEreignis = null;

const eigenstaendig = window.matchMedia("(display-mode: standalone)").matches
  || window.navigator.standalone === true;

async function richteAnleitungenEin() {
  const { erkenneGeraet, installationsweg } = await import('./installationswege.js');
  const system = document.getElementById('installieren-system');
  const browser = document.getElementById('installieren-browser');
  const ziel = document.getElementById('installieren-anleitung');
  if (!system || !browser || !ziel) return;
  const vermutung = erkenneGeraet(navigator);
  system.value = vermutung.system; browser.value = vermutung.browser;
  document.getElementById('installieren-erkennung').textContent = 'Für dein Gerät vorausgewählt. Du kannst die Auswahl jederzeit ändern.';
  function zeichne() {
    const weg = installationsweg(system.value,browser.value);
    const titel = document.createElement('h3'); titel.textContent=weg.titel;
    const liste = document.createElement('ol'); liste.className='installieren-schritte';
    for(const text of weg.schritte) {
      const zeile=document.createElement('li');
      if(system.value==='ios'&&text.includes('Teilen')){
        const stelle=text.indexOf('Teilen'),icon=document.createElement('img');icon.src='bilder/apple-teilen.png';icon.alt='';icon.width=25;icon.height=30;icon.className='installieren-original-icon';
        const wort=document.createElement('strong');wort.textContent='Teilen';
        zeile.append(document.createTextNode(text.slice(0,stelle)),icon,wort,document.createTextNode(text.slice(stelle+6)));
      }else zeile.textContent=text;
      liste.append(zeile);
    }
    const hinweis=document.createElement('p'); hinweis.className='installieren-hinweis';hinweis.textContent=weg.hinweis;
    ziel.replaceChildren(titel,liste,hinweis);
    if(system.value==='ios'){
      const quelle=document.createElement('a');quelle.href='https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios';quelle.target='_blank';quelle.rel='noopener noreferrer';quelle.className='installieren-quellenlink';quelle.textContent='Originalanleitung von Apple ↗';ziel.append(quelle);
    }
  }
  system.addEventListener('change',zeichne); browser.addEventListener('change',zeichne); zeichne();
}
void richteAnleitungenEin().catch(() => {
  const weitere=document.querySelector('.installieren-weitere'); if(weitere)weitere.open=true;
});

if (eigenstaendig) {
  direkt.hidden = false;
  knopf.hidden = true;
  stand.textContent = "Die Seite ist auf diesem Gerät bereits wie eine App geöffnet.";
}

window.addEventListener("beforeinstallprompt", (event) => {
  if (eigenstaendig) return;
  event.preventDefault();
  installEreignis = event;
  direkt.hidden = false;
  knopf.hidden = false;
  stand.textContent = "Dein Browser kann die Seite direkt installieren.";
});

knopf?.addEventListener("click", async () => {
  if (!installEreignis) return;
  knopf.disabled = true;
  const ereignis = installEreignis; installEreignis = null;
  try {
  await ereignis.prompt();
  const ergebnis = await ereignis.userChoice;
  stand.textContent = ergebnis.outcome === "accepted"
    ? "Die Website wird zum Home-Bildschirm hinzugefügt."
    : "Nicht installiert – du kannst es jederzeit erneut versuchen.";
  } catch {
    stand.textContent = 'Die direkte Installation ist gerade nicht möglich. Nutze die Anleitung für deinen Browser.';
  } finally {
  knopf.disabled = false;
  knopf.hidden = true;
  }
});
window.addEventListener('appinstalled', () => {
  installEreignis=null; direkt.hidden=false; knopf.hidden=true;
  stand.textContent='Die Website wurde installiert. Öffne sie künftig über das Kickers-Wappen.';
});
