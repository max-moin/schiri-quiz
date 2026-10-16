# Rote Karte und Sonderbericht

Stand 16.10.2026. Umsetzung nach Max' Kombination aus Spieltag-Guide und Matchplan.

## Entscheidungen

- Eigenständige Detailseite `rote-karte.html`, aus Hilfe und DFBnet-Hilfe erreichbar. Bestehender `hilfe.html#sonderbericht` und sein visueller Blockeditor bleiben erhalten; keine gespeicherten Redaktionsinhalte überschreiben. Ergänzung: Die Fachseite kann nun über denselben Blockeditor inhaltlich bearbeitet werden. Feste Vorlage statt freiem Layout-Umbau: Phasen, Nummern, Icons und Sicherheitsposition bleiben erhalten. Texte, Fokuspunkte/Listen, Bild und Quellen sind editierbar. Entwurf, Vorschau, Veröffentlichung und Historie verwenden die bisherigen AAL2-/vereinsgeschützten RPCs, eigenen Seitenschlüssel `rote-karte`; keine automatische Inhaltsveröffentlichung.
- Schrittfolge 0–7 in drei Phasen, „Im Spiel“ als Standard und mit breiterem Navigationsfeld. Nummern bleiben über Phasen hinweg gleich. Ohne JavaScript sind alle drei Phasen lesbar.
- Kurze Handlungstitel und wenige Fokuspunkte. „Mit Erklärungen“ ergänzt Fließtext innerhalb der aktuellen Phase statt alle Details global zu öffnen. Details haben ausdrücklich beschriftete Schaltflächen mit Pluszeichen. Sicherheitsinformation bleibt im Spiel direkt sichtbar.
- Normale Seitenfarben, kein dunkler Hero. Rote Karten-Grafik mit Neigung/Schatten bleibt. Aussagekräftige Icons, Spielfeldskizze beim Vorbereitungsschritt. Kein Fake-Screenshot.
- Max' anonymes Musterbild vollständig mit „Strafen für Spieler“, fester begrenzter Maximalbreite, proportionaler Höhe und Link zur großen Fassung. Nicht beschneiden; keine privaten Dashboard-Kontodaten verwenden.
- Bericht neutral beschreiben: Ablauf, Wortlaut, Trefferbild, Intensität, Folgen. Keine Strafmaßforderung; tatsächliche Kartenentscheidung/Grund nicht aus dem DFBnet weglassen. Beispiel ausdrücklich erfunden.
- 24 Stunden als vereinsinterne Empfehlung, offizielle Folgetagsfrist separat im Erläuterungstext und Quellenverzeichnis. Keine technische Uploadgrenze.
- Empfängerauswahl und örtliche Aufsicht nach Feldverweis bleiben benannte Prüfpunkte. Medizinische Ausnahme nach IFAB5.3 nicht auf jeden Trainer/Elternteil ausweiten.

## Forschungsbezug und Grenzen

Die Gestaltung nutzt Signalisierung (wenige hervorgehobene Schlüsselwörter/Nummern), räumliche Nähe passender Bilder und Texte sowie eine gegliederte, selbst wählbare Darstellung. Das sind begründete Designentscheidungen, kein Wirksamkeitsnachweis für diese Website oder für junge Schiedsrichter.

- Richter, Scheiter & Eitel (2016): *Signaling text-picture relations in multimedia learning*, Educational Research Review17,19–36. [Verlag/DOI](https://doi.org/10.1016/j.edurev.2015.12.003), [Universitätsnachweis](https://publikationen.uni-tuebingen.de/xmlui/handle/10900/75800). Verlags-Suchauszug beschreibt das Hervorheben relevanter Text-Bild-Bezüge; Volltext nicht zugänglich. Keine unüberprüften Effektgrößen übernehmen.
- Scheiter & Eitel (2015): *Signals foster multimedia learning by supporting integration of highlighted text and diagram elements*. [Verlag](https://www.sciencedirect.com/science/article/pii/S0959475214001054). Zugänglicher Verlags-Suchauszug zur gezielten Aufmerksamkeitslenkung; Volltextabruf403. Nicht pauschal auf Kinder oder jede Art von Icons übertragen.
- Molina Díaz et al.(2018): *Evaluating multimedia learning materials in primary education using eye tracking*. [Verlag](https://www.sciencedirect.com/science/article/pii/S0920548917303392), DOI10.1016/j.csi.2018.02.004. Verlags-Abstract beschreibt Geometrie-Materialien für7- und11-Jährige; Volltext403. Daraus keine konkrete Wirksamkeit unseres Guides ableiten.
- [Frontiers-Originalstudie2013](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00450/full) untersucht Einschätzungen von Erwachsenen zu Grundschulbüchern, nicht den Lernerfolg von Kindern. Deshalb nicht als Kinder-Wirksamkeitsbeleg verwenden. Ihr Theorieabschnitt unterscheidet erklärende und nur dekorative Bilder.

Fachquellen sind auf der Seite selbst beschriftet. Die wissenschaftlichen Gestaltungsquellen stehen nur hier, nicht als zusätzlicher Textblock in der jungen Zielgruppe.

## Redaktion: Bedienweg und Grenzen

Im Obmann-Zugang mit zweitem Faktor anmelden, anschließend den Guide erneut öffnen. „Seite bearbeiten“ blendet Bearbeiten-Schaltflächen direkt bei den Inhalten ein. Für Schritte lassen sich Titel, kurze Fokuspunkte und der Erklärungstext gemeinsam ändern; Listenpunkte hinzufügen/entfernen. Die Textansichten/Phasen funktionieren auch in der Vorschau weiter. Erst „Entwurf speichern“, dann prüfen und ausdrücklich „Veröffentlichen“. „Bearbeiten beenden“ zeigt wieder die veröffentlichte Fassung. Quellenlinks und Bildbeschreibungen bleiben Pflicht, Screenshots vor Upload anonymisieren.

Die Vorlage hat58 Inhaltsblöcke und passt in das vorhandene60-Block-Format. Keine neuen beliebig verschachtelten Komponenten, keine frei veränderbare Schritt-Reihenfolge/Phasenstruktur; so bleibt das von Max freigegebene Design erhalten. Feste Sicherheitsüberschriften und Phasenbeschriftungen sind Teil des Gerüsts. Allgemeine Hilfeseiten behalten ihren bisherigen freien Blockeditor. Bei einem späteren grundlegenden Vorlagenwechsel Inhaltsschlüssel explizit migrieren, nicht indexbasiert fremde Texte zuordnen. PostgreSQL-JSONB-Schlüsselreihenfolge darf keine Text-/Markupänderung auslösen.

Offene Fachpunkte bleiben Empfängerauswahl und örtliche Aufsicht Minderjähriger. Weitere DFBnet-Pakete: normaler Spielbericht Schritt für Schritt einschließlich Wiedereinwechslungen; persönliche Sperrtermine/Verfügbarkeit; Schiri-Beobachtung; Hintergrundwissen zu Spielersperren. Alte Handbücher sind keine aktuelle Sperrdauertabelle. Diese Seiten sind hiermit noch nicht gebaut.
