// ============================================================
// Schiri-Quiz - Auswertungs-Dashboard (nur fuer den Obmann)
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const passwortEingabe = document.getElementById("passwort-eingabe");
const loginButton = document.getElementById("login-button");
const loginSchritt = document.getElementById("login-schritt");
const dashboardSchritt = document.getElementById("dashboard-schritt");
const statGrid = document.getElementById("stat-grid");
const schiedsrichterFilter = document.getElementById("schiedsrichter-filter");
const rundenListe = document.getElementById("runden-liste");
const fehlerHinweis = document.getElementById("fehler-hinweis");

let alleZeilen = [];

function zeigeFehler(text) {
  fehlerHinweis.textContent = text;
  fehlerHinweis.hidden = false;
}

function versteckeFehler() {
  fehlerHinweis.hidden = true;
}

function formatDatum(iso) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function login() {
  const passwort = passwortEingabe.value.trim();
  if (!passwort) return;

  versteckeFehler();
  loginButton.disabled = true;
  loginButton.textContent = "Prüfe ...";

  const { data, error } = await sb.rpc("obmann_auswertung", { p_passwort: passwort });

  loginButton.disabled = false;
  loginButton.textContent = "Anmelden";

  if (error) {
    zeigeFehler("Falsches Passwort oder Fehler: " + error.message);
    return;
  }

  alleZeilen = data || [];
  loginSchritt.hidden = true;
  dashboardSchritt.hidden = false;
  baueFilterOptionen();
  render();
}

loginButton.addEventListener("click", login);
passwortEingabe.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

function baueFilterOptionen() {
  const namen = [...new Set(alleZeilen.map((z) => z.schiedsrichter))].sort();
  for (const name of namen) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    schiedsrichterFilter.appendChild(option);
  }
}

schiedsrichterFilter.addEventListener("change", render);

function render() {
  const gefiltertNach = schiedsrichterFilter.value;
  const zeilen = gefiltertNach
    ? alleZeilen.filter((z) => z.schiedsrichter === gefiltertNach)
    : alleZeilen;

  renderStatGrid(zeilen);
  renderRunden(zeilen);
}

function renderStatGrid(zeilen) {
  statGrid.innerHTML = "";

  const proPerson = new Map();
  for (const z of zeilen) {
    if (!proPerson.has(z.schiedsrichter)) {
      proPerson.set(z.schiedsrichter, { gesamt: 0, richtig: 0 });
    }
    const eintrag = proPerson.get(z.schiedsrichter);
    eintrag.gesamt += 1;
    if (z.korrekt) eintrag.richtig += 1;
  }

  const namenSortiert = [...proPerson.keys()].sort();

  if (namenSortiert.length === 0) {
    statGrid.innerHTML = '<p class="leer-hinweis">Noch keine Antworten vorhanden.</p>';
    return;
  }

  for (const name of namenSortiert) {
    const { gesamt, richtig } = proPerson.get(name);
    const quote = gesamt > 0 ? Math.round((richtig / gesamt) * 100) : 0;

    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="name">${escapeHtml(name)}</div>
      <div class="quote ${quote < 50 ? "schwach" : ""}">${quote}%</div>
      <div class="anzahl">${richtig} von ${gesamt} richtig</div>
    `;
    statGrid.appendChild(card);
  }
}

function renderRunden(zeilen) {
  rundenListe.innerHTML = "";

  if (zeilen.length === 0) {
    rundenListe.innerHTML = '<p class="leer-hinweis">Keine Einträge für diese Auswahl.</p>';
    return;
  }

  // Zeilen sind vom Server schon nach runde_start (neueste zuerst) sortiert.
  // Hier nur noch nach Runde gruppieren, Reihenfolge dabei beibehalten.
  const rundenReihenfolge = [];
  const rundenMap = new Map();

  for (const z of zeilen) {
    if (!rundenMap.has(z.runde)) {
      rundenMap.set(z.runde, { start: z.runde_start, zeilen: [] });
      rundenReihenfolge.push(z.runde);
    }
    rundenMap.get(z.runde).zeilen.push(z);
  }

  for (const rundenName of rundenReihenfolge) {
    const { start, zeilen: rundenZeilen } = rundenMap.get(rundenName);

    const block = document.createElement("div");
    block.className = "runde-block";

    const titel = document.createElement("div");
    titel.className = "runde-titel";
    titel.innerHTML = `${escapeHtml(rundenName)} <span class="runde-zeitraum">(seit ${formatDatum(start)})</span>`;
    block.appendChild(titel);

    const tabelle = document.createElement("table");
    tabelle.className = "antwort-tabelle";
    tabelle.innerHTML = `
      <thead>
        <tr>
          <th>Schiedsrichter</th>
          <th>Frage</th>
          <th>Antwort</th>
          <th>Richtige Antwort</th>
          <th>Ergebnis</th>
          <th>Wann</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = tabelle.querySelector("tbody");
    for (const z of rundenZeilen) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(z.schiedsrichter)}</td>
        <td>${escapeHtml(z.frage_text)}</td>
        <td>${escapeHtml(z.gegebene_antwort)}</td>
        <td>${escapeHtml(z.richtige_antwort)}</td>
        <td><span class="badge ${z.korrekt ? "badge-richtig" : "badge-falsch"}">${z.korrekt ? "Richtig" : "Falsch"}</span></td>
        <td>${formatDatum(z.beantwortet_am)}</td>
      `;
      tbody.appendChild(tr);
    }

    block.appendChild(tabelle);
    rundenListe.appendChild(block);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}
