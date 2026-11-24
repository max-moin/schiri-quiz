export const version = "kickers-stimmungsbild-v1";
export const tage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
export const tiers = ["A", "B", "C", "D", "E"];
export const zeiten = { min: 16 * 60, max: 19 * 60, schritt: 15, dauer: 120 };
export const zustimmung = ["Finde ich gut", "Wäre für mich okay", "Lieber nicht", "Keine Meinung"];
export const bewertungen = ["Gar nicht gut", "Nicht gut", "Neutral", "Gut", "Sehr gut"];
const wahl = (key, titel, optionen, max = 1) => ({ key, titel, optionen, max, typ: max === 1 ? "wahl" : "mehrfach" });
const text = (key, titel = "Noch etwas dazu? (freiwillig)", wenn) => ({ key, titel, typ: "text", wenn });
const skala = (key, titel, nicht = "Kann ich nicht beurteilen", labels = bewertungen) => ({ key, titel, typ: "likert", nicht, labels });
export const abschnitte = [
  { icon: "📅", titel: "Feste Konflikte", info: "Welche Tage fallen für dich regelmäßig aus? Zum Beispiel wegen Training, Arbeit oder Schule.", felder: [{key:"konflikte", typ:"konflikte"}, text("konfliktText")] },
  { icon: "🏅", titel: "Deine Wochen-Tierliste", info: "Zieh jeden möglichen Tag in eine Stufe. A passt am besten, E am wenigsten. Gleichstände sind ausdrücklich erlaubt.", felder: [{key:"tier", typ:"tier"}, text("tierText")] },
  { icon: "🕓", titel: "Wann kannst du starten?", info: "Beide Markierungen sind mögliche Startzeiten. Darunter siehst du das voraussichtliche Treffende bei bis zu zwei Stunden Dauer.", felder: [{key:"start", typ:"zeit"}, text("zeitText", "Besonderheiten zur Uhrzeit? (freiwillig)")] },
  { icon: "⚽", titel: "Treff-Rhythmus und Alternativen", info: "Was würdest du gerne statt oder zusätzlich zum Schiri-Treff machen?", felder: [{key:"frequenz", typ:"frequenz"},
    wahl("ideen","Wähle bis zu zwei Ideen.",["Zusammen Fußball schauen","Gemeinsam ins Stadion","Ein Spiel aus unserer Gruppe anschauen","Sport- oder Spieleabend","Kurze Clips und Regeln besprechen","Treff gern wie bisher"], 2),
    wahl("eigeneIdee","Noch eine andere Idee?",["Eigener Vorschlag"]), text("ideeText","Was ist deine Idee? (freiwillig)", "eigeneIdee"), text("treffText")] },
  { icon: "🤝", titel: "Rückhalt im Verein", info: "Hier geht es darum, wie es dir beim Pfeifen geht und was der Verein für dich tun kann.", felder: [
    wahl("motivation","Wie gern pfeifst du im Moment?",["Macht mir Spaß","Mal so, mal so","Aktuell eher wenig","Möchte ich nicht sagen"]),
    skala("verein","Wie zufrieden bist du mit dem Rückhalt im Verein?", undefined, ["Sehr unzufrieden","Unzufrieden","Neutral","Zufrieden","Sehr zufrieden"]),
    wahl("hilfe","Welche Unterstützung wünschst du dir am meisten? (bis zu zwei)",["Rückhalt bei schwierigen Spielen","Fachlicher Austausch mit erfahrenen Schiris","Ausrüstung","Einfachere Abrechnung","Finanzieller Zuschuss","Mehr gemeinsame Aktionen","Mir fehlt gerade nichts"],2),
    text("vereinText","Was wünschst du dir zusätzlich? (freiwillig)")] },
  { icon: "💻", titel: "DFBnet und Website", info: "Wo kommst du gut klar? Was sollte leichter zu finden sein?", felder: [
    skala("dfbnet","Wie gut findest du dich im DFBnet zurecht?","Nutze ich nicht"),
    skala("website","Wie gut findest du Dinge auf unserer Website?","Nutze ich nicht"),
    wahl("dfbnetHilfe","Wobei wäre eine Anleitung hilfreich?",["Spielbericht","Ansetzungen","Sperrtermine","Bei etwas anderem","Brauche ich nicht"]), text("digitalText")] },
  { icon: "🎯", titel: "Das Wochenquiz", info: "Bewerte Rhythmus und Umfang getrennt.", felder: [
    skala("quiz","Wie gut gefällt dir das Wochenquiz?","Nutze ich nicht"),
    wahl("quizOft","Wie findest du den Rhythmus?",["Passt","Zu häufig","Gern öfter","Keine Meinung"]),
    wahl("quizAnzahl","Wie findest du die Anzahl der Fragen pro Quiz?",["Zu wenige","Genau richtig","Zu viele","Nicht beurteilbar"]),
    skala("quizLayout","Wie gut findest du im Quiz, was du brauchst?","Nutze ich nicht"), text("quizText")] },
  { icon: "💬", titel: "Was soll ich in den Vorstand mitnehmen?", info: "Alles freiwillig. Bitte nenne keine Namen anderer Personen. Deine Freitexte sieht nur Max, nicht der Vorstand.", felder: [
    text("vorstandStoert","Das stört mich"), text("vorstandBleibt","Das soll so bleiben"), text("vorstandIdee","Das würde ich ändern")] },
  { icon: "👋", titel: "Schiris anderer Vereine als Gäste?", info: "Es geht nur um gelegentliche Einladungen, nicht um eine gemeinsame Gruppe.", felder: [
    wahl("treffExtern","Gäste beim ganzen Schiri-Treff",zustimmung),
    wahl("hrtExtern","Gäste nur bei der Hausregeltest-Besprechung",zustimmung), text("gaesteText")] },
  { icon: "📝", titel: "Was möchtest du noch sagen?", info: "Platz für alles, was noch nicht vorkam.", felder: [text("kommentar","Deine Rückmeldung (freiwillig)")] },
];
export const formatZeit = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
export const gueltigeZeit = m => Number.isInteger(m) && m >= zeiten.min && m <= zeiten.max && m % zeiten.schritt === 0;
export function zeitVerschieben(zeit, index, wert) {
  const gerundet = Math.round(wert / zeiten.schritt) * zeiten.schritt;
  return index === 0 ? [Math.min(zeit[1], Math.max(zeiten.min, gerundet)), zeit[1]]
    : [zeit[0], Math.max(zeit[0], Math.min(zeiten.max, gerundet))];
}
export function normalisiereAntwort(x) {
  if (!x || typeof x !== "object" || Array.isArray(x) || !Array.isArray(x.konflikte)
    || !x.konflikte.every(t => tage.includes(t)) || new Set(x.konflikte).size !== x.konflikte.length
    || !x.tier || typeof x.tier !== "object" || Array.isArray(x.tier)
    || !Array.isArray(x.start) || x.start.length !== 2 || !x.start.every(gueltigeZeit) || x.start[0] > x.start[1]
    || !Number.isInteger(x.frequenz) || x.frequenz < 0 || x.frequenz > 10) return null;
  const frei = tage.filter(t => !x.konflikte.includes(t));
  if (Object.keys(x.tier).length !== frei.length || !frei.every(t => Object.hasOwn(x.tier,t) && tiers.includes(x.tier[t]))) return null;
  const out = { konflikte:[...x.konflikte], tier:{...x.tier}, start:[...x.start], frequenz:x.frequenz, felder:[] };
  for (const f of abschnitte.flatMap(a => a.felder)) {
    const wert = x[f.key];
    if (wert === undefined || !["text","wahl","mehrfach","likert"].includes(f.typ)) continue;
    if (f.typ === "text") {
      if (typeof wert !== "string" || wert.length > 350) return null;
      if (wert.trim() && (!f.wenn || x[f.wenn])) out.felder.push({ key:f.key, titel:f.titel, text:wert.trim() });
    } else if (f.typ === "likert") {
      if (wert !== "na" && (!Number.isInteger(wert) || wert < 1 || wert > 5)) return null;
      out.felder.push({ key:f.key, titel:f.titel, text:wert === "na" ? f.nicht : f.labels[wert - 1], ...(wert === "na" ? {} : {wert}) });
    } else {
      const werte = f.typ === "mehrfach" ? wert : [wert];
      if (!Array.isArray(werte) || werte.length > f.max || new Set(werte).size !== werte.length || !werte.every(v => f.optionen.includes(v))) return null;
      // Die Antwort „Mir fehlt gerade nichts“ steht für sich.
      if (f.key === "hilfe" && werte.includes("Mir fehlt gerade nichts") && werte.length !== 1) return null;
      if (werte.length) out.felder.push({ key:f.key, titel:f.titel, text:werte.join(", ") });
    }
  }
  return out;
}
