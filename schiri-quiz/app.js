// ============================================================
// Schiri-Quiz - Frontend-Logik
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const nameAuswahl = document.getElementById("name-auswahl");
const startButton = document.getElementById("start-button");
const nameHinweis = document.getElementById("name-hinweis");
const nameSchritt = document.getElementById("name-schritt");
const fragenSchritt = document.getElementById("fragen-schritt");
const fragenListe = document.getElementById("fragen-liste");
const fertigHinweis = document.getElementById("fertig-hinweis");
const fehlerHinweis = document.getElementById("fehler-hinweis");

let ausgewaehlteSchiedsrichterId = null;
let offeneFragenAnzahl = 0;

function zeigeFehler(text) {
  fehlerHinweis.textContent = text;
  fehlerHinweis.hidden = false;
}

async function ladeSchiedsrichter() {
  const { data, error } = await sb
    .from("schiedsrichter")
    .select("id, name")
    .order("name");

  if (error) {
    zeigeFehler("Namensliste konnte nicht geladen werden: " + error.message);
    return;
  }

  for (const person of data) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    nameAuswahl.appendChild(option);
  }
}

nameAuswahl.addEventListener("change", () => {
  startButton.disabled = !nameAuswahl.value;
});

startButton.addEventListener("click", async () => {
  ausgewaehlteSchiedsrichterId = nameAuswahl.value;
  nameSchritt.hidden = true;
  fragenSchritt.hidden = false;
  await ladeFragen();
});

async function ladeFragen() {
  const { data: fragen, error } = await sb
    .from("fragen_oeffentlich")
    .select("id, frage_text, option_a, option_b, option_c")
    .order("erstellt_am");

  if (error) {
    zeigeFehler("Fragen konnten nicht geladen werden: " + error.message);
    return;
  }

  if (!fragen || fragen.length === 0) {
    fragenListe.innerHTML = "<p>Aktuell sind keine Fragen aktiv. Schau später nochmal vorbei.</p>";
    return;
  }

  offeneFragenAnzahl = fragen.length;

  for (const frage of fragen) {
    fragenListe.appendChild(baueFrageElement(frage));
  }
}

function baueFrageElement(frage) {
  const container = document.createElement("div");
  container.className = "frage";
  container.dataset.frageId = frage.id;

  const titel = document.createElement("div");
  titel.className = "frage-text";
  titel.textContent = frage.frage_text;
  container.appendChild(titel);

  const optionListe = document.createElement("div");
  optionListe.className = "option-liste";

  const optionen = [
    { key: "a", text: frage.option_a },
    { key: "b", text: frage.option_b },
    { key: "c", text: frage.option_c },
  ];

  for (const opt of optionen) {
    const label = document.createElement("label");
    label.className = "option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "frage-" + frage.id;
    radio.value = opt.key;

    label.appendChild(radio);
    label.append(opt.text);
    optionListe.appendChild(label);
  }

  container.appendChild(optionListe);

  const absendenButton = document.createElement("button");
  absendenButton.textContent = "Antwort abschicken";
  absendenButton.addEventListener("click", () => antwortAbschicken(frage.id, container, absendenButton));
  container.appendChild(absendenButton);

  const feedback = document.createElement("p");
  feedback.className = "feedback";
  feedback.hidden = true;
  container.appendChild(feedback);

  return container;
}

async function antwortAbschicken(frageId, container, button) {
  const gewaehlt = container.querySelector('input[type="radio"]:checked');
  if (!gewaehlt) {
    zeigeFehler("Bitte erst eine Antwort auswählen.");
    return;
  }
  fehlerHinweis.hidden = true;

  button.disabled = true;
  container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = true));

  const { data, error } = await sb.rpc("antwort_abgeben", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_frage_id: frageId,
    p_gegebene_option: gewaehlt.value,
  });

  const feedback = container.querySelector(".feedback");
  feedback.hidden = false;

  if (error) {
    feedback.textContent = "Fehler beim Speichern: " + error.message;
    feedback.classList.add("falsch");
    return;
  }

  const ergebnis = data[0];
  if (ergebnis.korrekt) {
    feedback.textContent = "Richtig! ✅";
    feedback.classList.add("richtig");
  } else {
    feedback.textContent = "Leider falsch. Richtig wäre gewesen: " + ergebnis.richtige_option.toUpperCase();
    feedback.classList.add("falsch");
  }

  offeneFragenAnzahl -= 1;
  if (offeneFragenAnzahl <= 0) {
    fertigHinweis.hidden = false;
  }
}

ladeSchiedsrichter();
