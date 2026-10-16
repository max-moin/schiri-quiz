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

Offene Fachpunkte bleiben Empfängerauswahl und örtliche Aufsicht Minderjähriger. Persönliche Sperrtermine/Verfügbarkeit, Schiri-Beobachtung und Hintergrundwissen zu Spielersperren bleiben weitere Pakete. Alte Handbücher sind keine aktuelle Sperrdauertabelle.

## Nächster Baustein: normaler Einzelspielbericht

`spielbericht.html` ergänzt den bestehenden Guide, ohne ihn umzubauen. Aus der Hilfe erreichbar, mit eigenem Wegweiser und kontextueller Seitenhilfe. Schritte 0–14 in drei Abschnitten: Vorbereiten, Eintragen (Standard), Abschließen. Kurze Fokuswörter, einblendbare Erklärungen, direkte Anker zu Wechseln/Karten/Vorkommnissen; keine DFBnet-Schreibaktion. Grün getönte Flächen und dieselben Icons/Karten-/Bedienbausteine. Die Grafik zur Wiedereinwechslung ist ausdrücklich ein Schema, keine nachgebaute DFBnet-Maske.

Die Reihenfolge folgt Max' aktuellem Praxisinput, Grundbegriffe der alten SFV-Anleitung und die noch geltenden Pflichten sind getrennt ausgewiesen. Bildschirmbeispiele von 2009 werden nicht als aktuelle Oberfläche veröffentlicht. Die Handreichung von 2024 wird nur auf passend konfigurierte Wettbewerbe angewendet: erstmals eingewechselte Person und erste Einwechselminute; ausgewechselte Person dort ohne Angabe. Keine pauschale Wiedereinwechslungserlaubnis.

Kosten ohne ungeprüfte Sätze und ohne Freischaltung des Spesenrechners; Verletzungen nicht als Pflichtschablone/Diagnose. Vorkommnisse und STOPP bewusst Ja/Nein nach Geschehen. Speichern, Freigeben, Torschützen/Bestätigung und Dokumente sind getrennte Schritte. Keine erfundene technische Uploadfrist oder Empfängerliste. Die Detailseite „Rote Karte“ enthält weiterhin Muster, Vorlagen und Schreibhilfe.

39 Inhaltsblöcke mit stabilen `data-sb-inhalt`-IDs und Vorlage `spielbericht-v1` werden über den vorhandenen Editor gepflegt: Schritttitel, Fokuslisten, Langtexte, Sonderfall-Hinweis und Quellen. Chronologie, Abschnitte und Schema bleiben fest. Keine Erweiterung zum freien Phasen-/Modus-Baukasten. Migration `20261016175530_spielbericht_blockredaktion` erweitert nur die bestehende Seiten-Allowlist; AAL2, Vereinszuordnung, Revisionen und private Entwürfe bleiben gleich. Keine vorhandenen Inhalte automatisch geändert oder veröffentlicht.

Fachliche Restprüfung: heutige Kontrollfelder und Dokument-Empfängerauswahl mit anonymem aktuellen Beispiel abgleichen; Rechte nach Freigabe je Wettbewerb prüfen. Die Anleitung behauptet dafür keine vollständige Live-Klickabnahme. Verknüpfte Quellen bleiben direkt auf der Seite mit Alter und Zweck sichtbar.

## Hilfe-Paket vervollständigt

Auf Max' Folgeauftrag sind die restlichen vereinbarten DFBnet-Themen umgesetzt: `dfbnet.html` als geordneter Einstieg, `sperrtermine.html`, `schiri-beobachtung.html` und `spielersperren.html`. Hilfe-Kacheln sind in „DFBnet & Spieltag“ und „Website & Verein“ gruppiert. Bestehende geteilte Fragmente `hilfe.html#dfbnet`, `#sonderbericht` und `#schiri-treff` samt bisherigen CMS-Inhalten bleiben erhalten. Die neue Übersicht ist keine Migration/Überschreibung alter freier Redaktionsinhalte.

Die drei neuen Guides verwenden die vorhandenen Phasen-/Textumfang-Bausteine und denselben Inhaltsadapter mit jeweils eigener Vorlagenkennung.25/23/24 feste Inhaltsblöcke; kein freier Baukasten. Bestehender Spielbericht bleibt unter `spielbericht-v1` rückwärtskompatibel. Migration `20261016181326_dfbnet_hilfe_redaktion` erweitert nur den vorhandenen Seitenschlüssel-CHECK und die private AAL2-/Vereinsprüfung um die drei Themen; keine neue Tabelle, keine zusätzlichen anonymen Schreibrechte und keine echte Inhaltsveröffentlichung.

Quellenentscheidungen: Die SVFD-Anweisung20.08.2026 liefert Fristen/Bestätigung/Absagepflichten. Die DFBnet-FAQ nennt den Orientierungsweg zu eigenen Daten/Terminen; der offizielle Modernisierungshinweis2025 erklärt den neuen Tab und verhindert, dass2012-Screenshots als heutiger Klickplan erscheinen. Beobachtungszugang und Gespräch/Bericht werden nach SFV-SRO§11(6) erklärt, ohne eine heutige konkrete Schaltfläche oder eigene Notenskala zu erfinden. Spielersperren sind auf Hintergrund zu Geltung/Ableistung/Systemhinweisen begrenzt. Das2017-Manual ist keine aktuelle Sperrdauertabelle und kein Freigabenachweis.

Max' nachgereichter [SVFD-Feedbackbogen](https://www.svf-dresden.de/dokumente/feedbackbogen-beobachtungsauswertung/) ist im Beobachtungs-Guide bereits oben direkt und beim passenden Abschlussschritt verlinkt. Er bewertet die Qualität von Beobachtung, Auswertungsgespräch und Bericht, nicht die Leistungsnote des Schiedsrichters. Je beteiligter SR-Person ist pro Spiel eine Rückmeldung vorgesehen. Persönliche Eingabe von Name/E-Mail nicht als anonyme Abgabe bewerben: laut SVFD erst gesammelte anonymisierte halbjährliche Weitergabe an den Beobachter. Kein nachgebautes Formular, kein iFrame, keine lokale Speicherung/Übermittlung des Feedbacks.

Offen bleiben nur die bereits benannten echten Kontrollfeld-/Empfänger-Screenshots und die lokale Minderjährigen-Aufsicht. Aktuelle DFBnet-Rollenansichten und echte Endgeräte bleiben menschlich abzugleichen. Das Paket behauptet weder Zugriff auf fremde Beobachtungen noch eine Spielberechtigungsauskunft, und es schaltet Regeln/Spesen nicht frei.
