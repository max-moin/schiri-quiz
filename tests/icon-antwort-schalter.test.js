import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/* ============================================================
   Optionale Bestandteile der Icon-Antwort (v101/v102, 31.08.2026)
   ============================================================
   Max: "Okay, wo ist gar nicht gefordert, das braucht man nicht angeben,
   kann man ausschalten - oder auch Spielfortsetzung ist nicht gefragt,
   es ist nur gefragt, welche persoenliche Strafe es da gibt."

   Die gefaehrlichste Eigenschaft dieser Runde sieht man nicht: dass ein
   nicht gefragter Bestandteil weder als fehlend noch als falsch zaehlt.
   Wer das kaputtmacht, merkt es nicht am Bildschirm - sondern erst,
   wenn ein Schiedsrichter eine richtige Antwort als falsch bewertet
   bekommt. Genau dafuer sind diese Tests da.
   ============================================================ */

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

const MIGRATIONEN = new URL("../supabase/migrations/", import.meta.url);
const migration = (teil) => {
  const datei = readdirSync(MIGRATIONEN).find((n) => n.includes(teil));
  assert.ok(datei, `Migration mit "${teil}" im Namen fehlt`);
  return readFileSync(new URL(datei, MIGRATIONEN), "utf8");
};

const ohneSqlKommentare = (sql) => sql.replace(/--[^\n]*/g, "");
const ohneJsKommentare = (js) =>
  js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Der Rumpf EINER Funktion - eine Zusicherung darf nie die ganze Datei treffen. */
function funktionsRumpf(sql, name) {
  let start = sql.indexOf(`create function public.${name}(`);
  if (start < 0) start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `Funktion ${name} nicht gefunden`);
  const ende = sql.indexOf("$function$;", start);
  assert.ok(ende > start, `Ende von ${name} nicht gefunden`);
  return sql.slice(start, ende);
}

const SCHALTER = [
  "fordert_fortsetzung", "fordert_fortsetzung_fuer", "fordert_fortsetzung_ort",
  "fordert_strafe", "fordert_strafe_mannschaft", "fordert_strafe_rolle",
  "fordert_strafe_nummer", "zeigt_trikotfarben",
];

// ============================================================
//  1. Die Datenbank laesst keine leere Frage zu
// ============================================================

test("eine Frage muss mindestens einen Hauptbestandteil verlangen", () => {
  const v101 = ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder"));
  assert.match(v101, /constraint frage_entscheidung_hat_hauptteil/);
  assert.match(v101, /check \(fordert_fortsetzung or fordert_strafe\)/);
});

test("ein Unterschalter darf nicht ohne seinen Hauptbestandteil an sein", () => {
  const v101 = ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder"));
  assert.match(v101, /constraint frage_entscheidung_unterschalter_haengen/);
  for (const paar of [
    ["fordert_fortsetzung_fuer", "fordert_fortsetzung"],
    ["fordert_fortsetzung_ort", "fordert_fortsetzung"],
    ["fordert_strafe_mannschaft", "fordert_strafe"],
    ["fordert_strafe_rolle", "fordert_strafe"],
    ["fordert_strafe_nummer", "fordert_strafe"],
  ]) {
    assert.match(v101, new RegExp(`not ${paar[0]}\\s*or ${paar[1]}`),
      `${paar[0]} haengt nicht an ${paar[1]}`);
  }
});

test("ein Wert steht genau dann da, wenn er verlangt wird", () => {
  // Sonst bliebe beim Umkonfigurieren ein verwaister Loesungswert stehen,
  // der spaeter nicht mehr als Altlast zu erkennen waere.
  const v101 = ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder"));
  assert.match(v101, /constraint frage_entscheidung_werte_passen_zu_schaltern/);
  assert.match(v101, /\(spielfortsetzung\s+is not null\) = fordert_fortsetzung/);
  assert.match(v101, /\(persoenliche_strafe\s+is not null\) = fordert_strafe/);
});

// ============================================================
//  2. Nicht gefragt heisst weder richtig noch falsch
// ============================================================

test("die Teilnoten duerfen leer sein", () => {
  // NOT NULL waere hier toedlich: "war nicht gefragt" ist null, und ohne
  // diese Aenderung scheitert jede Antwort auf eine Frage mit
  // abgeschalteten Bestandteilen an einer NOT-NULL-Verletzung.
  const v101 = ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder"));
  const block = v101.slice(v101.indexOf("alter table public.antwort_entscheidungen"));
  for (const spalte of ["fortsetzung_richtig", "strafe_richtig", "ort_richtig"]) {
    assert.match(block, new RegExp(`alter column ${spalte}\\s+drop not null`),
      `${spalte} ist noch NOT NULL`);
  }
});

test("die Bewertung ergibt null statt false, wenn nicht gefragt war", () => {
  const rumpf = funktionsRumpf(
    ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder")),
    "entscheidung_antwort_speichern");

  // Jede Teilnote haengt an ihrem Schalter. Ein "case when ... then ..."
  // OHNE else ergibt null - genau das ist gewollt.
  //
  // Das "ohne else" ist der eigentliche Punkt und war in der ersten
  // Fassung dieses Tests nicht geprueft: ein angehaengtes "else false"
  // laesst das case-when stehen und macht trotzdem aus jedem nicht
  // gefragten Bestandteil eine falsche Antwort. Die Sabotageprobe hat
  // das Loch gefunden, nicht das Lesen.
  const teilnoten = [
    ["v_fortsetzung_ok", "fordert_fortsetzung"],
    ["v_richtung_ok", "fordert_fortsetzung_fuer"],
    ["v_ort_ok", "fordert_fortsetzung_ort"],
    ["v_strafe_ok", "fordert_strafe"],
    ["v_strafziel_ok", "fordert_strafe_mannschaft"],
    ["v_rolle_ok", "fordert_strafe_rolle"],
    ["v_nummer_ok", "fordert_strafe_nummer"],
  ];
  for (const [variable, schalter] of teilnoten) {
    const anfang = rumpf.indexOf(`${variable} := case when v_loesung.${schalter}`);
    assert.ok(anfang >= 0, `Teilnote ${variable} haengt nicht an ${schalter}`);
    const zuweisung = rumpf.slice(anfang, rumpf.indexOf(";", anfang));
    assert.doesNotMatch(zuweisung, /\belse\b/,
      `${variable} hat ein else - dann waere ein nicht gefragter Bestandteil wieder falsch statt null`);
  }
  // Und das Gesamtergebnis darf davon nicht kippen.
  assert.match(rumpf, /coalesce\(v_fortsetzung_ok, true\)/);
  assert.match(rumpf, /coalesce\(v_strafe_ok, true\)/);
});

test("die Pflichtpruefung im Server richtet sich nach der Konfiguration", () => {
  const rumpf = funktionsRumpf(
    ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder")),
    "entscheidung_antwort_speichern");
  // Frueher war Spielfortsetzung IMMER Pflicht - bei einer reinen
  // Strafenfrage haette der Aufrufer etwas mitschicken muessen, wonach
  // nie gefragt wurde.
  assert.match(rumpf, /if v_loesung\.fordert_fortsetzung then[\s\S]{0,400}Spielfortsetzung ungueltig/);
  assert.match(rumpf, /if v_loesung\.fordert_strafe then[\s\S]{0,400}Persoenliche Strafe ungueltig/);
});

test("die Schalter landen im Schnappschuss der Antwort", () => {
  // Wird eine Frage spaeter umkonfiguriert, muss eine alte Antwort
  // lesbar bleiben wie am Tag der Abgabe - sonst zeigt die Historie ein
  // Kreuz bei einem Feld, das es damals gar nicht gab.
  const rumpf = funktionsRumpf(
    ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder")),
    "entscheidung_antwort_speichern");
  assert.match(rumpf, /v_loesung_json\s*:=[\s\S]{0,900}\|\|\s*v_schalter/);
});

// ============================================================
//  3. Der Browser bekommt die Schalter - und nur die
// ============================================================

test("wochen_fragen liefert alle acht Schalter", () => {
  const v102 = ohneSqlKommentare(migration("v102_wochen_fragen_mit_icon_schaltern"));
  for (const schalter of SCHALTER) {
    assert.match(v102, new RegExp(`\\b${schalter} boolean`), `${schalter} fehlt`);
  }
});

test("wochen_fragen liefert KEINE Loesungswerte", () => {
  const v102 = ohneSqlKommentare(migration("v102_wochen_fragen_mit_icon_schaltern"));
  const kopf = v102.slice(v102.indexOf("returns table("), v102.indexOf("language plpgsql"));
  // Wortgrenze davor, sonst trifft die Suche fordert_strafe_mannschaft.
  for (const spalte of ["spielfortsetzung", "persoenliche_strafe", "fortsetzung_ort",
                        "fortsetzung_fuer", "strafe_fuer_mannschaft", "richtige_option"]) {
    assert.doesNotMatch(kopf, new RegExp(`(^|[ ,(])${spalte}\\s`),
      `wochen_fragen liefert ${spalte} - das ist die Antwort, nicht die Frage`);
  }
});

test("wochen_fragen wirft keine Frage ohne Icon-Loesung heraus", () => {
  // Ein inner join haette praktisch das gesamte Wochenquiz geleert.
  const rumpf = funktionsRumpf(
    ohneSqlKommentare(migration("v102_wochen_fragen_mit_icon_schaltern")), "wochen_fragen");
  assert.match(rumpf, /left join frage_entscheidungsloesungen/);
  assert.doesNotMatch(rumpf, /\n\s*join frage_entscheidungsloesungen/);
});

// ============================================================
//  4. Oberflaeche und Server sagen dasselbe
// ============================================================

test("das Quizformular zeigt nur, was verlangt wird", () => {
  const js = ohneJsKommentare(lies("src/features/decision-answers.js"));
  assert.match(js, /function verlangt\(frage, name\)/);

  // Die Zusicherung gilt dem ZEICHNEN, nicht der Datei. Sonst genuegt es,
  // dass derselbe Schalter irgendwo anders vorkommt - etwa in
  // istVollstaendig - und die Anzeige darf ihn stillschweigend
  // ignorieren. Genau das ist bei der Sabotageprobe passiert.
  // Bis zu istVollstaendig, NICHT bis aktualisiereSenden: istVollstaendig
  // steht dazwischen und benutzt dieselben Schalternamen. Der zu grosse
  // Ausschnitt hat die Sabotage zweimal durchgelassen.
  const zeichnen = js.slice(js.indexOf("function zeichneForm("),
                            js.indexOf("function istVollstaendig("));
  assert.ok(zeichnen.length > 500, "zeichneForm nicht gefunden");
  for (const schalter of ["fordert_fortsetzung", "fordert_fortsetzung_fuer",
                          "fordert_fortsetzung_ort", "fordert_strafe",
                          "fordert_strafe_mannschaft"]) {
    assert.match(zeichnen, new RegExp(`verlangt\\(frage, "${schalter}"\\)`),
      `${schalter} steuert die Anzeige nicht`);
  }

  // Und dasselbe fuer die Pflichtpruefung im Browser.
  const pruefung = js.slice(js.indexOf("function istVollstaendig("),
                            js.indexOf("function aktualisiereSenden("));
  for (const schalter of ["fordert_fortsetzung", "fordert_strafe",
                          "fordert_strafe_mannschaft", "fordert_strafe_rolle"]) {
    assert.match(pruefung, new RegExp(`verlangt\\(frage, "${schalter}"\\)|fordert_strafe_nummer`),
      `${schalter} geht nicht in die Pflichtpruefung ein`);
  }
  // Fehlender Schalter heisst "verlangt" - lieber zu streng als
  // stillschweigend nachlaessig.
  assert.match(js, /frage\?\.\[name\] !== false/);
});

test("Trikotfarben sind abschaltbar und rein optisch", () => {
  const js = ohneJsKommentare(lies("src/features/decision-answers.js"));
  assert.match(js, /function zeigtTrikotfarben\(frage\)/);
  assert.match(js, /if \(!zeigtTrikotfarben\(frage\)\) return button/);

  // Und sie duerfen nirgends in die Bewertung eingehen.
  const rumpf = funktionsRumpf(
    ohneSqlKommentare(migration("v101_optionale_icon_antwortfelder")),
    "entscheidung_antwort_speichern");
  assert.doesNotMatch(rumpf, /v_korrekt[\s\S]{0,300}trikot/);
});

test("die Serverroute prueft Form und Vollstaendigkeit getrennt", () => {
  // Die Vollstaendigkeit laesst sich erst pruefen, wenn die Frage
  // bekannt ist - vorher weiss niemand, was sie ueberhaupt verlangt.
  const js = ohneJsKommentare(lies("api/entscheidung-bewerten.js"));
  assert.match(js, /function pruefeForm\(antwort\)/);
  assert.match(js, /function pruefeVollstaendig\(antwort, kontext\)/);

  const formRumpf = js.slice(js.indexOf("function pruefeForm("),
                             js.indexOf("function pruefeVollstaendig("));
  // "Antwort fehlt." darf pruefeForm sagen - ein fehlendes Objekt ist ein
  // Formfehler. Aber kein einzelnes Feld darf dort als Pflicht gelten.
  for (const feld of ["Spielfortsetzung fehlt", "Persönliche Strafe fehlt",
                      "Ort der Spielfortsetzung fehlt", "Mannschaft der Spielfortsetzung fehlt",
                      "Rolle der bestraften Person fehlt"]) {
    assert.ok(!formRumpf.includes(feld),
      `pruefeForm verlangt "${feld}", ohne die Frage zu kennen`);
  }

  // Und die Vollstaendigkeitspruefung muss NACH dem Laden des Kontexts
  // stehen, sonst hat sie keine Schalter.
  // Die AUFRUFSTELLE muss nach dem Laden stehen, nicht die Definition -
  // indexOf haette sonst die Funktionsdefinition weiter oben getroffen
  // und den Test gruen gelassen, ohne etwas zu pruefen.
  assert.ok(js.indexOf("const fehlendes = pruefeVollstaendig(antwort, kontext);")
            > js.indexOf("entscheidung_kontext_laden"),
    "pruefeVollstaendig laeuft vor dem Laden des Kontexts");
});

// ============================================================
//  5. Mehrere gueltige Rollen (v103, 31.08.2026)
// ============================================================

test("mehrere Rollen koennen gleichzeitig richtig sein", () => {
  // Max an einem echten Fall: der Spielertrainer auf der Bank ist
  // Trainer UND Auswechselspieler. Vorher bekam ein Kreuz, wer die
  // andere - ebenso richtige - Rolle waehlte.
  const v103 = ohneSqlKommentare(migration("v103_mehrere_gueltige_rollen"));
  assert.match(v103, /add column if not exists strafe_rollen_gueltig text\[\]/);

  // Die Bewertung muss die Liste auch BENUTZEN. Die Spalte anzulegen und
  // sie dann nicht zu lesen war beim ersten Anlauf genau der Fehler.
  const rumpf = funktionsRumpf(v103, "entscheidung_antwort_speichern");
  const zuweisung = rumpf.slice(rumpf.indexOf("v_rolle_ok := case when"));
  assert.match(zuweisung.slice(0, zuweisung.indexOf(";")),
    /entscheidung_teilnote_rolle\(\s*p_antwort->>'strafe_fuer_rolle',\s*v_loesung\.strafe_rollen_gueltig\)/,
    "die Bewertung vergleicht weiter nur mit der einen angezeigten Rolle");
});

test("die angezeigte Rolle muss unter den gueltigen sein", () => {
  // Sonst zeigte die Aufloesung eine Antwort, die die Bewertung selbst
  // als falsch wertet.
  const v103 = ohneSqlKommentare(migration("v103_mehrere_gueltige_rollen"));
  assert.match(v103, /constraint frage_entscheidung_rolle_ist_gueltig/);
  assert.match(v103, /strafe_fuer_rolle = any\(strafe_rollen_gueltig\)/);
});

test("die Rollenliste steht im Schnappschuss der Antwort", () => {
  const rumpf = funktionsRumpf(
    ohneSqlKommentare(migration("v103_mehrere_gueltige_rollen")),
    "entscheidung_antwort_speichern");
  const schnappschuss = rumpf.slice(rumpf.indexOf("v_loesung_json :="),
                                    rumpf.indexOf("v_fortsetzung_ok :="));
  assert.match(schnappschuss, /'strafe_rollen_gueltig'/,
    "ohne die Liste zeigt die Historie spaeter ein Kreuz bei einer Rolle, die damals richtig war");
});

// ============================================================
//  6. Die Icons (31.08.2026, Max' Rueckmeldung zum Screenshot)
// ============================================================

test("jede Spielfortsetzung hat Icon, vollen Namen und Kurzform", () => {
  return import("../src/website/entscheidungs-optionen.js").then((modul) => {
    for (const f of modul.FORTSETZUNGEN) {
      assert.ok(f.icon.startsWith("<svg"), `${f.schluessel} hat kein Icon`);
      assert.ok(f.label && f.label.length > 2, `${f.schluessel} hat kein Textlabel`);
      assert.ok(f.kurz && f.kurz.length > 2, `${f.schluessel} hat keine Kurzform`);
      // Die Kurzform darf nie laenger sein als der volle Name.
      assert.ok(f.kurz.length <= f.label.length, `${f.schluessel}: Kurzform ist laenger`);
    }
    assert.equal(modul.fortsetzungKurz("sr_ball"), "SR-Ball");
    assert.equal(modul.fortsetzungLabel("sr_ball"), "Schiedsrichter-Ball");
  });
});

test("der Knopf zeigt kurz und spricht lang", () => {
  // Abgekuerzt wird nur, was man sieht. Wer vorlesen laesst, hoert
  // weiterhin den vollen Namen.
  const js = ohneJsKommentare(lies("src/features/decision-answers.js"));
  assert.match(js, /langtext: eintrag\.label/);
  assert.match(js, /setAttribute\("aria-label", langtext\)/);
});

test("ein zu langes Wort schiebt das Icon nicht mehr aus dem Knopf", () => {
  // Max' Screenshot vom 31.08.2026: bei "Schiedsrichter Ball" stand das
  // Icon zwischen zwei Knoepfen im Nichts. Ursache: das Symbol steht auf
  // flex:0 0 auto und kann nicht schrumpfen, der Text hatte kein
  // min-width:0 - also lief er ueber und schob bei zentriertem Inhalt
  // das Icon nach links hinaus.
  const css = lies("stil/wochen-entscheidung.css");
  assert.match(css, /\.entscheidung-knopf \{[^}]*overflow: hidden/);
  assert.match(css, /\.entscheidung-knopf > span:last-child \{[^}]*min-width: 0/);
});

test("das Feld fuer den eigenen Ort ist wirklich versteckt", () => {
  // display:grid schlaegt das display:none, das der Browser fuer [hidden]
  // mitbringt - ohne die eigene Regel bleibt das Feld sichtbar, obwohl
  // im JavaScript korrekt "label.hidden = true" steht.
  const css = lies("stil/wochen-entscheidung.css");
  assert.match(css, /\.entscheidung-anderer-ort\[hidden\] \{ display: none; \}/);
});
