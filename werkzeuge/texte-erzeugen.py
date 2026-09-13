# Erzeugt src/website/redaktionstexte-standard.js aus dem HTML.
# Nie von Hand pflegen - sonst laufen Vorgabe und Seite auseinander.
import re, json, glob, io

SEITEN = {
  "start":          ("Startseite",        "index.html"),
  "schiri-werden":  ("Schiri werden",     "schiri-werden.html"),
  "spesen":         ("Spesenrechner",     "spesenrechner.html"),
  "unterlagen":     ("Unterlagen",        "informationen.html"),
  "regeln":         ("Regelübersicht",    "regeluebersicht.html"),
}
BESCHRIFTUNG = {
  "kicker": "Kleinzeile über der Überschrift", "titel": "Große Überschrift",
  "unter": "Zeile darunter", "knopf-links": "Linker Knopf", "knopf-rechts": "Rechter Knopf",
  "bereich-schiris": "Überschrift „Für unsere Schiedsrichter“",
  "warum": "Überschrift des Warum-Abschnitts", "weg": "Überschrift „Der Weg zur Pfeife“",
  "pate": "Überschrift Patenabschnitt", "fragen": "Überschrift Fragenabschnitt",
  "schluss": "Überschrift am Seitenende",
  "schritt-1": "Überschrift Schritt 1", "schritt-2": "Überschrift Schritt 2",
  "schritt-3": "Überschrift Schritt 3", "schritt-4": "Überschrift Schritt 4",
}

def inhalt(html, schluessel):
    # Oeffnendes Tag mit dem Haken finden, dann bis zum passenden
    # Schlusstag desselben Namens lesen. Die markierten Elemente sind
    # bewusst flach - kein gleichnamiges Tag darin.
    treffer = re.search(r'<([a-z0-9]+)([^>]*?)data-text="%s"([^>]*)>' % re.escape(schluessel), html)
    assert treffer, schluessel
    name = treffer.group(1)
    start = treffer.end()
    ende = html.index("</%s>" % name, start)
    assert html.count("<%s" % name, start, ende) == 0, "verschachtelt: " + schluessel
    return html[start:ende]

gefunden = {}
for kurz, (label, datei) in SEITEN.items():
    html = open(datei, encoding="utf-8").read()
    for schluessel in re.findall(r'data-text="([^"]+)"', html):
        assert schluessel.startswith(kurz + "."), (datei, schluessel)
        gefunden[schluessel] = inhalt(html, schluessel)

zeilen = []
zeilen.append("// ============================================================")
zeilen.append("//  Ausgangsstand der redaktionellen Texte")
zeilen.append("// ------------------------------------------------------------")
zeilen.append("//  ERZEUGT - nicht von Hand aendern. Diese Datei wird aus den")
zeilen.append("//  data-text-Haken im HTML gebaut (werkzeuge/texte-erzeugen.mjs)")
zeilen.append("//  und von tests/redaktionstexte.test.js gegen das HTML geprueft.")
zeilen.append("//  Wer hier tippt, erzeugt genau die Abweichung, die der Test")
zeilen.append("//  verhindern soll: im Editor stuende dann ein anderer Text als")
zeilen.append("//  auf der Seite.")
zeilen.append("// ============================================================")
zeilen.append("")
zeilen.append("export const TEXTE_STANDARD = Object.freeze({")
for k in sorted(gefunden):
    zeilen.append("  %s: %s," % (json.dumps(k, ensure_ascii=False), json.dumps(gefunden[k], ensure_ascii=False)))
zeilen.append("});")
zeilen.append("")
zeilen.append("// Gruppierung fuer den Editor: eine Karte je Seite, in der")
zeilen.append("// Reihenfolge, in der die Texte auf der Seite stehen.")
zeilen.append("export const TEXT_SEITEN = Object.freeze([")
for kurz, (label, datei) in SEITEN.items():
    felder = [k for k in gefunden if k.startswith(kurz + ".")]
    felder.sort(key=lambda k: list(gefunden).index(k))
    zeilen.append("  Object.freeze({")
    zeilen.append("    schluessel: %s," % json.dumps(kurz, ensure_ascii=False))
    zeilen.append("    titel: %s," % json.dumps(label, ensure_ascii=False))
    zeilen.append("    datei: %s," % json.dumps(datei, ensure_ascii=False))
    zeilen.append("    felder: Object.freeze([")
    for f in felder:
        name = f.split(".", 1)[1]
        zeilen.append("      Object.freeze({ schluessel: %s, beschriftung: %s })," % (
            json.dumps(f, ensure_ascii=False),
            json.dumps(BESCHRIFTUNG.get(name, name), ensure_ascii=False)))
    zeilen.append("    ]),")
    zeilen.append("  }),")
zeilen.append("]);")
zeilen.append("")

open("src/website/redaktionstexte-standard.js", "w", encoding="utf-8").write("\n".join(zeilen))
print("erzeugt:", len(gefunden), "Texte")
