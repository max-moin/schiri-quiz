# Private Wochenserie und Abzeichen

## Zugang und Grenzen

Kontomenü → Meine Quizstatistik. Nur die eigene ID plus passende aktive PIN
kann `meine_wochenserie_basis` lesen. Keine Rangliste, kein Obmann-Aggregat,
keine neue Push-/E-Mail-Kategorie und keine neuen Lern- oder Profiltabellen.
Die neue RPC ist ausdrücklich rein lesend; bestehende Tabellen bleiben gesperrt.

## Regeln

- Alle zugeordneten Fragen einer Runde abschließend beantwortet: Woche zählt.
  Falsche Antworten sind erlaubt; offene `nachbessern`-Antworten noch nicht fertig.
- Laufende Runden unterbrechen noch nichts. Ohne Quizzuordnung kein Serienbruch.
  Runden vor Kontoerstellung werden nicht nachträglich als Versäumnis gewertet.
- Eine ausgelassene Woche kann in sieben Berliner Kalendertagen nach Rundenende
  gerettet werden. Fünf **verschiedene** korrekt gespeicherte `historie_antworten`
  im Fenster sind erforderlich; Wiederholungen zählen einmal. Falsche Versuche
  setzen den Fortschritt nicht zurück. Gastmodus und Duelle zählen nicht.
- Das Fenster ist halb offen: Ende eingeschlossen, Frist ausgeschlossen. Die
  Datenbankzeit gilt, nicht eine verstellte Geräteuhr. Sommerzeit wird berücksichtigt.
- Rettungen werden rückblickend aus den Antwortlogs abgeleitet. Kein lokaler
  Zähler, kein zu manipulierender Erfolgsparameter und keine Schreib-RPC nötig.
- Eine offene Lücke zählt noch nicht zur Serie. Die Oberfläche zeigt die frühere
  Serie und den Rettungsfortschritt. Neue Abzeichen entstehen nicht vorzeitig.
- Rettung verändert keine Wochenantworten, Trefferquoten, Saisonpunkte oder
  administrativen Quizabschlüsse. Die bestehende Wochenquiz-Sperre vor Üben bleibt:
  offene aktuelle Fragen zuerst abschließen, danach `quiz.html#ueben`.

## Anzeige

Aktuelle/längste Serie und regulär abgeschlossene Wochen. Vier private Abzeichen:
Erste Woche, vier Wochen „Drangeblieben“, acht Wochen „Regelroutine“, eine Rettung
„Wieder da“. Ruhige Karten mit Textstatus, nicht nur Farbunterschieden. Keine Sounds
oder Erfolgsanimationen; Reduced-Motion-Regel vorsorglich vorhanden.

## Datenherkunft und Korrekturen

Stand wird geräteübergreifend aus `antworten`, `runden_fragen` und
`historie_antworten` berechnet. Nach administrativen Korrekturen/Änderungen an
Zuordnungen wird auch die Anzeige neu abgeleitet. Abzeichen sind damit keine
irreversiblen Zertifikate oder neue personenbezogene Akten. Nach Rückkehr zur
Statistik werden Daten neu geladen; Kontowechsel/Abmelden löschen den sichtbaren
alten Stand sofort. Netzwerkfehler werden nicht als Nullserie dargestellt.

## Prüfungen

`node --test tests/wochenserie*.test.js` – Serien-/Frist-/Abzeichenregeln,
Kontowechsel, Abmelden, defekte Antwort, verworfener Request und Freitext-Renderer.

`supabase/tests/wochenserie-rollback.sql` – isolierte synthetische Daten,
falsche/fremde PIN, fehlende Nachbesserung, Wiederholungen, falsche/frühe Übungen,
fünfte richtige Frage, keine Nachtragung ins Wochenquiz und Berliner Sommerzeit.
Der Test enthält BEGIN/ROLLBACK und darf niemals zum dauerhaften Befüllen genutzt werden.

Lokale UI-Vorschau mit explizit künstlichen Daten separat; keine echten Quizantworten
für einen technischen Test abgeben. Nach Max' Push auf einem echten Konto/iPhone
Ansicht und Rückkehr nach Üben prüfen.
