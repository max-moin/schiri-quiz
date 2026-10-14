import { pruefeGeraetename } from '../features/geraetename.js';

// Eigener kleiner Editor: Themenentwurf, Geräteliste und Scrollposition
// bleiben beim Speichern unverändert. Fehler behalten den eingegebenen Namen.
export function baueGeraetenameBearbeitung({geraet, speichern, istAktuell, umbenannt}) {
  const knopf = document.createElement('button');
  knopf.type = 'button'; knopf.textContent = 'Umbenennen';
  knopf.setAttribute('aria-label', `${geraet.geraet || 'Gerät'} umbenennen`);
  knopf.setAttribute('aria-expanded', 'false');
  const formular = document.createElement('form');
  formular.className = 'mitteilungen-geraetename'; formular.hidden = true;
  formular.id = `geraetename-${geraet.id}`;
  knopf.setAttribute('aria-controls', formular.id);
  const label = document.createElement('label');
  label.textContent = 'Gerätename'; label.htmlFor = `${formular.id}-eingabe`;
  const eingabe = document.createElement('input');
  eingabe.id = label.htmlFor; eingabe.type = 'text'; eingabe.required = true;
  eingabe.autocomplete = 'off'; eingabe.value = geraet.geraet || '';
  const hinweis = document.createElement('small');
  hinweis.id = `${formular.id}-hinweis`; hinweis.textContent = '1–60 Zeichen · z. B. Mein iPad';
  const status = document.createElement('p');
  status.id = `${formular.id}-status`; status.setAttribute('role', 'status');
  eingabe.setAttribute('aria-describedby', `${hinweis.id} ${status.id}`);
  const aktionen = document.createElement('div'); aktionen.className = 'mitteilungen-aktionen';
  const sichern = document.createElement('button'); sichern.type = 'submit'; sichern.textContent = 'Speichern';
  const abbrechen = document.createElement('button'); abbrechen.type = 'button'; abbrechen.textContent = 'Abbrechen';
  aktionen.append(sichern, abbrechen); formular.append(label, eingabe, hinweis, aktionen, status);
  let laeuft = false;
  function schliessen() { formular.hidden = true; knopf.setAttribute('aria-expanded', 'false'); knopf.focus(); }
  knopf.addEventListener('click', () => {
    if (!istAktuell()) return;
    eingabe.value = geraet.geraet || ''; status.textContent = ''; eingabe.removeAttribute('aria-invalid');
    formular.hidden = false; knopf.setAttribute('aria-expanded', 'true'); eingabe.focus(); eingabe.select();
  });
  abbrechen.addEventListener('click', schliessen);
  formular.addEventListener('keydown', e => { if (e.key === 'Escape' && !laeuft) { e.preventDefault(); schliessen(); } });
  formular.addEventListener('submit', async e => {
    e.preventDefault();
    if (laeuft || !istAktuell()) return;
    const name = pruefeGeraetename(eingabe.value);
    if (!name) { eingabe.setAttribute('aria-invalid', 'true'); status.textContent = 'Bitte 1–60 Zeichen ohne Steuerzeichen eingeben.'; eingabe.focus(); return; }
    laeuft = true; sichern.disabled = true; abbrechen.disabled = true; eingabe.disabled = true; knopf.disabled = true;
    eingabe.removeAttribute('aria-invalid'); status.textContent = 'Wird gespeichert …';
    try {
      const antwort = await speichern(name);
      if (!istAktuell()) return;
      if (antwort?.id !== geraet.id || typeof antwort.geraet !== 'string') throw new Error('Gerätename konnte nicht bestätigt werden. Bitte erneut versuchen.');
      geraet.geraet = antwort.geraet; umbenannt(antwort.geraet);
      knopf.setAttribute('aria-label', `${antwort.geraet} umbenennen`);
      formular.hidden = true; knopf.setAttribute('aria-expanded', 'false');
    } catch (fehler) {
      if (istAktuell()) status.textContent = `${fehler.message} Deine Eingabe bleibt erhalten.`;
    } finally {
      if (istAktuell()) {
        laeuft = false; sichern.disabled = false; abbrechen.disabled = false; eingabe.disabled = false; knopf.disabled = false;
        if (formular.hidden) knopf.focus();
      }
    }
  });
  return {knopf, formular};
}
