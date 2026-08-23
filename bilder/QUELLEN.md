# Bilder und Motive

## Warum hier keine Stockfotos mehr stehen

Bis zum 21.08.2026 lagen auf der Seite Fotos von Pexels. Neun der zehn
Adressen waren geraten – bei älteren Pexels-Fotos enthält der Dateiname nicht
nur die Nummer, sondern auch den Titel des Bildes. Nur die Adresse des
Aufmachers stammte wörtlich aus der Quelle, und genau die war die einzige, die
tatsächlich lud. Deshalb blieben Kacheln leer.

Aus der Arbeitsumgebung heraus lassen sich diese Adressen nicht prüfen. Jede
weitere Runde damit wäre wieder Raten gewesen.

Dazu kam Max' berechtigte Frage, an welchen Bildern er überhaupt Rechte hat.
Die Lizenzen von Pexels, Unsplash und Pixabay decken **nur das Urheberrecht**
ab – nicht das Recht am eigenen Bild und keine Markenrechte. Bei einer
Schiedsrichterseite mit Jugendbezug ist das kein theoretisches Risiko.

**Selbst gezeichnete Motive lösen beides auf einmal:** sie gehören dem Verein,
sie liegen auf dem eigenen Server (kein Datenabfluss an Dritte), und sie sind
immer da.

## Was jetzt drin ist

| Datei | Motiv | Verwendung |
|---|---|---|
| `motiv-aufmacher.svg` | Spielfeld mit Mittelkreis, Ball auf dem Anstoßpunkt | Aufmacher Startseite, Kopfbild Schiri werden |
| `motiv-spesen.svg` | Strafraum von schräg, gelbe und rote Karte | Bildzeile Spesenrechner |
| `motiv-regeln.svg` | Spielfeld als Diagramm, komplett | Bildzeile Regelübersicht, Schiri werden |
| `motiv-quiz.svg` | Fußball groß, angeschnitten | Kachel Regelquiz, Schiri werden |
| `motiv-absage.svg` | Eckfahne am leeren Feld | Kachel Absagen |
| `motiv-dokumente.svg` | Gestapelte Blätter | Kachel Dokumente |
| `motiv-ausruestung.svg` | Karten und Ball | Kachel Ausrüstung |

Alle im selben Aufbau: Vereinsgrün mit Verlauf, dezente Rasenstreifen, weiße
Spielfeldlinien, ein kräftiges Objekt. Als SVG beliebig skalierbar, zusammen
unter 20 KB.

## Vereinseigenes

| Datei | Herkunft | Verwendung |
|---|---|---|
| `logo.png` | Vom Verein, von Max am 18.08.2026 geliefert (99×99, transparent) | Kopfbereich aller Seiten, Tab-Symbol |
| `logo@4x.png` | Hochgerechnete Fassung (396×396, Lanczos) | Für große Darstellungen |

## Wenn echte Fotos dazukommen sollen

Der Tausch ist trivial: im HTML nur den Dateinamen ersetzen. Die Fläche hat ein
festes Seitenverhältnis, das Bild wird mittig zugeschnitten – es kann nichts
verrutschen.

**Aufnahmeliste, nach Nutzen sortiert.** Alles ohne erkennbare Gesichter, oder
mit schriftlicher Einwilligung der Abgebildeten (bei Minderjährigen der
Erziehungsberechtigten):

1. **Aufmacher, quer (2:1).** Der eigene Platz, am besten früh oder abends bei
   flachem Licht. Menschenleer oder nur von hinten und weit entfernt.
2. **Ausrüstung (16:11).** Die eigenen Schiri-Trikots ausgebreitet, dazu
   Pfeife, Karten, Uhr. Von oben fotografiert. Ohne fremde Sponsorenlogos.
3. **Schiri werden (4:3).** Zwei Schiedsrichter beim Einlaufen von hinten, oder
   die Fahne des Assistenten am Spielfeldrand.
4. **Regellehrabend (4:3).** Der Raum, die Leinwand, Notizzettel – ohne
   Gesichter erkennbar.

Format: quer, mindestens 1600 px breit, JPEG. Vor dem Einbau auf etwa 200 KB
verkleinern.
