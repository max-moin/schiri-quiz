# ============================================================
#  Erzeugt src/website/redaktionstexte-standard.js aus dem HTML
# ------------------------------------------------------------
#  Nie von Hand pflegen. Die Wahrheit steht in den data-text-Haken
#  im HTML; diese Datei baut daraus den Ausgangsstand fuer den
#  Editor. tests/redaktionstexte.test.js vergleicht beides wieder
#  zeichengenau - laufen sie auseinander, wird der Test rot.
#
#  Aufruf:  python3 werkzeuge/texte-erzeugen.py
# ============================================================
import re, json

SEITEN = [
  ("start",         "Startseite",     "index.html"),
  ("schiri-werden", "Schiri werden",  "schiri-werden.html"),
  ("spesen",        "Spesenrechner",  "spesenrechner.html"),
  ("unterlagen",    "Unterlagen",     "informationen.html"),
  ("regeln",        "Regelübersicht", "regeluebersicht.html"),
]

# Gruppen buendeln zusammengehoerige Felder im Editor. Reihenfolge
# entscheidet, welche Regel zuerst greift.
GRUPPEN = [
  (re.compile(r"^weg-\d"),      "Der Weg zur Pfeife"),
  (re.compile(r"^(frage|antwort)-\d"), "Häufige Fragen"),
  (re.compile(r"^zahl-\d"),     "In Zahlen"),
  (re.compile(r"^kachel-\d"),   "Die drei Kacheln"),
  (re.compile(r"^schritt-\d"),  "Die vier Schritte"),
  (re.compile(r"^(warum|pate)"),"Textabschnitte"),
  (re.compile(r"^hinweis-"),    "Hinweise an den Feldern"),
  (re.compile(r"^(ergebnis|haftung)"), "Am Ende der Rechnung"),
  (re.compile(r"^(schluss|quellenhinweis)"), "Seitenende"),
]

FEST = {
  "kicker": "Kleinzeile über der Überschrift",
  "titel": "Große Überschrift",
  "unter": "Zeile unter der Überschrift",
  "knopf-links": "Linker Knopf",
  "knopf-rechts": "Rechter Knopf",
  "bereich-schiris": "Überschrift „Für unsere Schiedsrichter“",
  "warum": "Überschrift des Abschnitts",
  "warum-1": "Erster Absatz",
  "warum-2": "Zweiter Absatz",
  "weg": "Überschrift „Der Weg zur Pfeife“",
  "pate": "Überschrift des Abschnitts",
  "pate-1": "Erster Absatz",
  "pate-2": "Zweiter Absatz",
  "fragen": "Überschrift des Fragenabschnitts",
  "schluss": "Überschrift am Seitenende",
  "schluss-text": "Text am Seitenende",
  "quellenhinweis": "Quellenhinweis unter den Fragen",
  "erklaerung": "Erklärung im Aufklapper",
  "haftung": "Haftungshinweis",
  "ergebnis-titel": "Überschrift des Ergebnisses",
  "ergebnis-text": "Text unter dem Ergebnis",
  "hinweis-schnellwahl": "Hinweis an der Schnellauswahl",
  "hinweis-turnier": "Hinweis zum Turniersatz",
  "hinweis-tarifzone": "Hinweis zur Tarifzone",
  "hinweis-fahrschein": "Hinweis zu Fahrausweisen",
  "hinweis-strecke": "Hinweis zur Strecke",
  "hinweis-vereinssitz": "Hinweis zur Postleitzahl",
}

TEILE = {"titel": "Überschrift", "text": "Text", "dauer": "Dauer", "wert": "Zahl"}

def beschriftung(name):
    if name in FEST:
        return FEST[name]
    m = re.match(r"^(weg|zahl|kachel|schritt)-(\d+)(?:-(\w+))?$", name)
    if m:
        art = {"weg": "Schritt", "zahl": "Zahl", "kachel": "Kachel", "schritt": "Schritt"}[m.group(1)]
        teil = TEILE.get(m.group(3), m.group(3) or "")
        return f"{art} {m.group(2)}" + (f" · {teil}" if teil else "")
    m = re.match(r"^(frage|antwort)-(\d+)(b?)$", name)
    if m:
        wort = "Frage" if m.group(1) == "frage" else "Antwort"
        zusatz = " (zweiter Absatz)" if m.group(3) else ""
        return f"{wort} {m.group(2)}{zusatz}"
    return name

def gruppe(name):
    for muster, titel in GRUPPEN:
        if muster.match(name):
            return titel
    return "Kopf der Seite"

def inhalt(html, schluessel):
    treffer = re.search(r'<([a-z0-9]+)([^>]*?)data-text="%s"([^>]*)>' % re.escape(schluessel), html)
    assert treffer, schluessel
    name, start = treffer.group(1), treffer.end()
    ende = html.index("</%s>" % name, start)
    assert html.count("<%s" % name, start, ende) == 0, "verschachteltes <%s> in %s" % (name, schluessel)
    return html[start:ende]

gefunden, reihenfolge = {}, []
for kurz, label, datei in SEITEN:
    html = open(datei, encoding="utf-8").read()
    for schluessel in re.findall(r'data-text="([^"]+)"', html):
        assert schluessel.startswith(kurz + "."), (datei, schluessel)
        assert schluessel not in gefunden, "doppelt: " + schluessel
        gefunden[schluessel] = inhalt(html, schluessel)
        reihenfolge.append(schluessel)

z = []
z.append("// ============================================================")
z.append("//  Ausgangsstand der redaktionellen Texte")
z.append("// ------------------------------------------------------------")
z.append("//  ERZEUGT von werkzeuge/texte-erzeugen.py - nicht von Hand")
z.append("//  aendern. Die Wahrheit sind die data-text-Haken im HTML.")
z.append("//  tests/redaktionstexte.test.js vergleicht beides zeichengenau.")
z.append("// ============================================================")
z.append("")
z.append("export const TEXTE_STANDARD = Object.freeze({")
for k in reihenfolge:
    z.append("  %s: %s," % (json.dumps(k, ensure_ascii=False), json.dumps(gefunden[k], ensure_ascii=False)))
z.append("});")
z.append("")
z.append("// Gliederung fuer den Editor: eine Karte je Seite, darin")
z.append("// Gruppen in der Reihenfolge, in der sie auf der Seite stehen.")
z.append("export const TEXT_SEITEN = Object.freeze([")
for kurz, label, datei in SEITEN:
    eigene = [k for k in reihenfolge if k.startswith(kurz + ".")]
    z.append("  Object.freeze({")
    z.append("    schluessel: %s," % json.dumps(kurz, ensure_ascii=False))
    z.append("    titel: %s," % json.dumps(label, ensure_ascii=False))
    z.append("    datei: %s," % json.dumps(datei, ensure_ascii=False))
    z.append("    gruppen: Object.freeze([")
    gesehen = []
    for k in eigene:
        g = gruppe(k.split(".", 1)[1])
        if g not in gesehen:
            gesehen.append(g)
    for g in gesehen:
        z.append("      Object.freeze({ titel: %s, felder: Object.freeze([" % json.dumps(g, ensure_ascii=False))
        for k in eigene:
            name = k.split(".", 1)[1]
            if gruppe(name) != g:
                continue
            z.append("        Object.freeze({ schluessel: %s, beschriftung: %s })," % (
                json.dumps(k, ensure_ascii=False), json.dumps(beschriftung(name), ensure_ascii=False)))
        z.append("      ]) }),")
    z.append("    ]),")
    z.append("  }),")
z.append("]);")
z.append("")
open("src/website/redaktionstexte-standard.js", "w", encoding="utf-8").write("\n".join(z))
print("erzeugt:", len(gefunden), "Texte in", len(SEITEN), "Seiten")
