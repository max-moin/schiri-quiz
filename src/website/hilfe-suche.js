export const filter = {
  thema: { dfbnet:"DFBnet", schutz:"Schutz & Regeln", praxis:"Spieltag & Praxis", verein:"Verein & Website" },
  rolle: { schiri:"Schiedsrichter", trainer:"Trainer / Mannschaft", obmann:"Obmann", spieler:"Spieler", zuschauer:"Zuschauer", interesse:"Interessierte" },
  phase: { davor:"Vor dem Spiel", dabei:"Während des Spiels", danach:"Nach dem Spiel", jederzeit:"Jederzeit" },
};

// Redaktioneller Katalog: alle kombinierten Filter stammen von denselben Einträgen.
export const katalog = [
  ["Nichtantritt & Ersatz", "hilfe.html#nichtantritt", "Nichtantritt melden, Spielbericht bearbeiten und Einsatz zuordnen.", "dfbnet", "schiri trainer obmann", "davor danach", "angesetzter schiri kommt nicht|schiri taucht nicht auf|schiri ist nicht aufgetaucht|schiedsrichter erscheint nicht|ersatz pfeifen|eingesprungen|umtragung|spiel anrechnen|anrechnung nachträglich|anrechnung einsatz"],
  ["Spielbericht", "spielbericht.html", "Spielverlauf bearbeiten, speichern und freigeben.", "dfbnet", "schiri trainer", "danach", "spielbericht online|aufstellung|spielverlauf|wechsel|torschützen|freigabe"],
  ["Rote Karte & Sonderbericht", "rote-karte.html", "Feldverweis dokumentieren und Bericht schreiben.", "dfbnet schutz", "schiri obmann", "davor dabei danach", "sonderbericht|rot gegeben|rot vor anpfiff|rote karte vor spielbeginn|feldverweis|bericht schreiben"],
  ["Ansetzung absagen", "vorlagen.html", "Rückgabe einer Ansetzung und E-Mail-Vorlage.", "dfbnet", "schiri obmann", "davor", "spiel zurückgeben|absagen|absetzen|absage mail|angesetztes spiel nicht pfeifen"],
  ["Sperrtermin eintragen", "sperrtermine.html", "Abwesenheiten im DFBnet hinterlegen.", "dfbnet", "schiri obmann", "davor jederzeit", "sperrtermin|freihalten|nicht verfügbar|urlaub|abwesenheit"],
  ["Schiri-Beobachtung", "schiri-beobachtung.html", "Informationen zum Beobachtungsablauf.", "dfbnet", "schiri obmann", "davor danach", "beobachtung|beobachtungsbogen|beobachter"],
  ["Spielersperren", "spielersperren.html", "Informationen zu gesperrten Spielern.", "dfbnet", "trainer schiri obmann spieler", "davor danach", "spiel sperren|spieler gesperrt|sperre spieler|spielberechtigung"],
  ["Bedrängt oder bedroht", "hilfe.html#bedraengt", "Sicherheit, Ansprechpersonen und vertrauliche Meldung.", "schutz", "schiri trainer obmann spieler", "dabei danach", "angst|kinderschutz|minderjährig|trainer bedrängt|trainer droht|kabine|bedrohung melden"],
  ["Beleidigung, Diskriminierung und Zurufe", "hilfe.html#diskriminierung", "Regel 12 und den DFB-Drei-Stufen-Plan einordnen (DFB / IFAB).", "schutz", "schiri trainer obmann spieler zuschauer", "dabei danach", "beleidigung|beleidigender zuruf|rassismus|diskriminierung|religiöse beleidigung|religiöser zuruf|spieler beten|zuschauer|abbruch|unterbrechung|drei stufen plan|drohung von außen"],
  ["Spesenrechner", "spesenrechner.html", "Sätze nach Wettbewerb und Kosten nachschlagen.", "praxis", "schiri trainer obmann", "davor danach", "quittung|abrechnung|fahrtkosten|entschädigung|spesen jugendspiel|d jugend stadtverband"],
  ["Regelübersicht", "regeluebersicht.html", "Regeln und Dokumente zum Wettbewerb nachschlagen.", "schutz praxis", "schiri trainer obmann", "davor jederzeit", "spezielle ligaregeln|fussballregeln|regelwerk|regeldokumente"],
  ["Schiedsrichter werden", "schiri-werden.html", "Einstieg, Ausbildung und Kontakt.", "verein", "interesse trainer obmann", "jederzeit", "neuling|anfänger|ausbildung|lehrgang|mitmachen|anwärter|schiri werden"],
  ["Schiri-Treff", "hilfe.html#schiri-treff", "Termin, Themen und Protokoll.", "verein", "schiri obmann", "jederzeit", "schiri treff|treffen|protokoll|hausregeltest besprechung"],
  ["Hausregeltest", "hausregeltest.html", "Hausregeltest bearbeiten und exportieren.", "verein", "schiri obmann", "jederzeit", "hr t|hrt|hausregeltest|auswerter|antworten exportieren"],
  ["Website als App", "installieren.html", "Website zum Home-Bildschirm hinzufügen.", "verein", "schiri trainer obmann interesse", "jederzeit", "installation|app herunterladen|homescreen|startbildschirm"],
  ["Mitteilungen", "mitteilungen.html", "Benachrichtigungen und Gerätestatus einstellen.", "verein", "schiri obmann", "jederzeit", "push|notification|benachrichtigungen|testmitteilung"],
  ["Ausrüstung", "ausruestung.html", "Ausrüstung ansehen und anfragen.", "verein", "schiri obmann", "jederzeit", "trikot|stutzen|kleidung|ausrüstung bestellen"],
  ["Feedback & Hilfe", "melden.html", "Website-Fehler und Ideen melden.", "verein", "schiri trainer obmann interesse", "jederzeit", "bug|technisches problem|idee|feedback"],
  ["Quiz & Anmeldung", "modus.html", "Zu Wochenquiz, Üben und Duell.", "verein", "schiri obmann", "jederzeit", "login|anmelden|quiz|duell|fragen üben"],
  ["Spielvorbereitung", "https://www.meinfussball.de/schiris/aktive/spielvorbereitung", "Praxistipps · DFB / MEIN FUSSBALL", "praxis", "schiri interesse", "davor", "spielvorbereitung|vorbereitung|spieltag checkliste"],
  ["Warm-up vor dem Spiel", "https://www.meinfussball.de/schiris/aktive/warm-up", "Praxistipps · DFB / MEIN FUSSBALL", "praxis", "schiri interesse", "davor", "warm up|aufwärmen|aufwaermen|erwärmung"],
  ["Fitness für Schiris", "https://www.meinfussball.de/schiris/aktive/fitness", "Praxistipps · DFB / MEIN FUSSBALL", "praxis", "schiri interesse", "jederzeit", "fitness|kondition|lauftraining"],
].map(([titel, href, beschreibung, thema, rolle, phase, alias]) => ({
  titel, href, beschreibung, thema:thema.split(" "), rolle:rolle.split(" "), phase:phase.split(" "), alias:alias.split("|"),
}));

const stop = new Set("der die das den dem des ein eine ist hat sind von im in es ich bei am was wenn und für wie zu mir einen kann will wir sich nicht".split(" "));
const norm = t => t.toLowerCase().replace(/[äöüß]/g, c => ({ä:"ae",ö:"oe",ü:"ue",ß:"ss"})[c]).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = t => [...new Set(norm(t).split(" ").filter(w => w.length > 1 && !stop.has(w)))];
const austausch = new Map(Object.entries({schiedsrichter:"schiri",schiris:"schiri",schiedsrichterin:"schiri",referee:"schiri",drohung:"bedrohung",ersatzschiedsrichter:"ersatz",rot:"feldverweis"}));
const canonical = w => austausch.get(w) || w;
const freigabepflicht = { "spesenrechner.html":"spesen","regeluebersicht.html":"regeln" };
function dist(a,b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows = [[...Array(b.length + 1)].map((_, i) => i)];
  for (let i=1;i<=a.length;i++) {
    rows[i]=[i];
    for (let j=1;j<=b.length;j++) {
      rows[i][j]=Math.min(rows[i-1][j]+1, rows[i][j-1]+1, rows[i-1][j-1]+Number(a[i-1]!==b[j-1]));
      if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j], rows[i-2][j-2]+1);
    }
  }
  return rows[a.length][b.length];
}
function match(a,b) {
  a=canonical(a); b=canonical(b);
  if(a===b) return 1;
  if(a.length>=4 && b.startsWith(a)) return .79;
  const l=Math.min(a.length,b.length);
  if(l<4) return 0;
  const d=dist(a,b);
  return d===1 ? .68 : l>=8 && d===2 ? .52 : 0;
}
const index=katalog.map(x => ({x, titel:tokens(x.titel), text:tokens([x.beschreibung,...x.alias].join(" ")), ausdruecke:[x.titel,...x.alias].map(norm)}));
const h=Object.fromEntries([...new Set(index.flatMap(e => [...e.titel,...e.text].map(canonical)))].map(t => [t,index.filter(e => [...e.titel,...e.text].map(canonical).includes(t)).length]));

export function suche(q="", auswahl={}, freigaben={}) {
  const w=tokens(q);
  const suchtext=norm(q);
  return index.filter(({x}) => (!freigabepflicht[x.href] || freigaben[freigabepflicht[x.href]]===true)
    && Object.keys(filter).every(k => !auswahl[k] || x[k].includes(auswahl[k])))
    .map(e => {
      if (!suchtext) return {x:e.x,punkte:1};
      if (!w.length) return {x:e.x,punkte:0};
      let treffer=0, summe=0, relevant=false;
      for (const wort of w) {
        const title=Math.max(0,...e.titel.map(t=>match(wort,t)));
        const text=Math.max(0,...e.text.map(t=>match(wort,t)));
        const faktor=Math.max(title*1.22,text);
        const gewicht=1+Math.log((index.length+1)/((h[canonical(wort)]||1)+1));
        if (faktor>0) { treffer++; summe+=gewicht*faktor; if ((h[canonical(wort)]||1)<7) relevant=true; }
      }
      const phrase=e.ausdruecke.some(a=>a.includes(" ") && (" "+suchtext+" ").includes(" "+a+" "));
      return {x:e.x,punkte:phrase || (relevant && treffer>=Math.ceil(w.length*.5)) ? summe*(treffer/w.length)+(phrase?10:0):0};
    }).filter(e=>e.punkte>0).sort((a,b)=>b.punkte-a.punkte).map(e=>e.x);
}
