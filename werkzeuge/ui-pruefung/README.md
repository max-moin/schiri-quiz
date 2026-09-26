# UI-Prüfung

Prüft jede Seite der Website (alle `*.html` im Hauptordner) automatisch auf
Barrierefreiheit und Layout – in zwei Breiten (Handy 390 px, Laptop 1280 px)
und zwei Datenzuständen (abgemeldet / angemeldet mit Beispieldaten).

**Die echte Datenbank wird nie angefasst.** Alle Supabase-Aufrufe werden im
Browser abgefangen und aus `zustaende.py` beantwortet; alle anderen fremden
Adressen sind gesperrt.

## Einmal einrichten (Mac)

```
pip3 install playwright
python3 -m playwright install chromium
```

## Laufen lassen

Im Hauptordner der Website:

```
python3 werkzeuge/ui-pruefung/pruefen.py
```

Dauert ca. 2 Minuten. Danach liegt in
`werkzeuge/ui-pruefung/ergebnis/<Datum_Uhrzeit>/`:

- `bericht.md` – alle Befunde in Worten, je Seite
- `bilder/` – ein Bildschirmfoto je Seite, Breite und Zustand
- `ergebnis.json` – dieselben Befunde maschinenlesbar

Der Ordner `ergebnis/` kommt nicht ins Git.

Nützliche Schalter:

| Schalter | Wirkung |
|---|---|
| `--seiten quiz.html,termine.html` | nur diese Seiten |
| `--breiten 390` | nur Handybreite |
| `--zustaende angemeldet` | nur ein Datenzustand |
| `--ohne-bilder` | keine Bildschirmfotos (schneller) |
| `--streng` | Exit-Code 1 bei Befunden (für automatische Prüfungen) |

## Was geprüft wird (WCAG 2.2 AA)

| Befund | Regel |
|---|---|
| JavaScript-Fehler beim Laden | – |
| Seite breiter als der Bildschirm | 1.4.10 |
| Knopf/Link ohne Namen | 4.1.2 |
| Eingabefeld ohne Beschriftung (Platzhalter zählt nicht) | 3.3.2 |
| Bild ohne `alt` | 1.1.1 |
| doppelte `id` | – |
| Textkontrast unter 4,5:1 (großer Text 3:1) | 1.4.3 |
| Tippfläche unter 24 × 24 px (mit der Abstands-Ausnahme) | 2.5.8 |
| Tastaturfokus nicht sichtbar (12 × Tab) | 2.4.7 |
| *Hinweis:* Knopf nur mit Symbol | Hausregel „Wörter statt bloßer Icons“ |

Text über Fotos misst die Prüfung nicht (die Farbe darunter ist unbekannt) –
das bleibt ein Blick auf die Bildschirmfotos.

## Neuen Datenzustand anlegen

In `zustaende.py` unter `ZUSTAENDE` einen Eintrag ergänzen: Sitzung (oder
`None`) und ein Wörterbuch `RPC-Name → Antwort`. Unbekannte RPCs liefern `[]`.

## Dateien

- `pruefen.py` – startet einen lokalen Webserver, öffnet Chromium, schreibt den Bericht
- `pruefungen.js` – die Messungen, die in der Seite laufen
- `zustaende.py` – die Beispieldaten
