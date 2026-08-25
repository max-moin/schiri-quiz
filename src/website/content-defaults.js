/**
 * Statische, mit dem Code ausgelieferte Ausgangsdaten der drei redaktionellen
 * Website-Bereiche. Veröffentlichte Supabase-Daten dürfen diese Werte
 * ersetzen; bei leerer oder gestörter Datenbank bleiben sie der Fallback.
 */

export const REGELN_STANDARD = {
  "schemaVersion": 1,
  "quellen": {
    "svfd": {
      "titel": "Stadtverband Fußball Dresden",
      "stand": "Kurzübersicht 2024, ergänzt um die Handreichung 2025/2026",
      "warnung": true,
      "hinweis": "Die Kurzübersicht ist weiterhin die veröffentlichte Fassung des Stadtverbands. Für C- und D-Junioren gilt sie aber nicht mehr unverändert: Die Handreichung des Jugendausschusses für 2025/2026 hat sie dort ersetzt, und die Angaben hier sind bereits danach aktualisiert. Was diese Übersicht gar nicht nennt, ist eine Temperatur-Obergrenze – auf Landesebene sind das +35 °C, bei D-Junioren +32 °C, und am Spieltag entscheidet der Schiedsrichter.",
      "link": "https://www.svf-dresden.de/docs/schiedsrichter/regelwerk/kurzuebersicht-regeln/",
      "linkText": "Kurzübersicht beim Stadtverband"
    },
    "sfv": {
      "titel": "Sächsischer Fußball-Verband",
      "stand": "Regelungsübersicht Junioren 2026/27, Stand 01.07.2026",
      "warnung": false,
      "hinweis": "Gilt für Sachsenliga, Sachsenklasse und Landespokal der A- bis D-Junioren. Frauen und Juniorinnen stehen in einer eigenen Übersicht, die hier noch nicht eingepflegt ist – Link unten.",
      "link": "https://www.sfv-online.de/fileadmin/content/PDFs/Spielbetrieb/Junioren/Saison_2026_2027/regelungsuebersicht.pdf",
      "linkText": "Original-PDF des SFV"
    }
  },
  "svfdMeister": [
    {
      "a": "Herren",
      "k": "Stadtklassen bis Stadtoberliga",
      "zeit": "2×45 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 7,
      "w": 5,
      "wieder": "nicht möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "Herren",
      "k": "Freizeitliga/-klassen SVFD",
      "zeit": "2×45 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 7,
      "w": 5,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "Frauen",
      "k": "Landesliga",
      "zeit": "2×45 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 7,
      "w": 5,
      "wieder": "nicht möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "Frauen",
      "k": "Landesklasse",
      "zeit": "2×45 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 7,
      "w": 5,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "Frauen",
      "k": "Sparkassenliga",
      "zeit": "2×45 min",
      "feld": "halbes Großfeld",
      "max": 7,
      "min": 5,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "A-Junioren",
      "k": "Landesklassen bis Landesliga",
      "zeit": "2×45 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 8,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "A-Junioren",
      "k": "Stadtklassen bis Stadtoberliga",
      "zeit": "2×45 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 8,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "B-Junioren",
      "k": "Landesklassen bis Landesliga",
      "zeit": "2×40 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 8,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "B-Junioren",
      "k": "Stadtklassen bis Stadtoberliga",
      "zeit": "2×40 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 8,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "B-Juniorinnen",
      "k": "Landesliga (Großfeld)",
      "zeit": "2×40 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 8,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −6 °C",
      "fuss": "Abhängig von der Mannschaftsstärke, ob mit 9 oder 11 Spielerinnen gespielt wird."
    },
    {
      "a": "B-Juniorinnen",
      "k": "Landesliga (verkürztes Großfeld)",
      "zeit": "2×40 min",
      "feld": "verkürztes Großfeld",
      "max": 9,
      "min": 7,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −6 °C",
      "fuss": "Abhängig von der Mannschaftsstärke, ob mit 9 oder 11 Spielerinnen gespielt wird."
    },
    {
      "a": "B-Juniorinnen",
      "k": "Landesklasse",
      "zeit": "2×40 min",
      "feld": "halbes Großfeld",
      "max": 7,
      "min": 5,
      "w": 7,
      "wieder": "möglich",
      "gr": "5 min",
      "t": "< −6 °C"
    },
    {
      "a": "C-Junioren",
      "k": "alle Spielklassen (9 gegen 9)",
      "zeit": "2×40 min in vier Vierteln à 20 min",
      "feld": "65×45 bis 75×55 m",
      "max": 9,
      "min": null,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −6 °C",
      "extra": [
        [
          "Tore",
          "Kleinfeldtore"
        ],
        [
          "Strafraum",
          "12 × 29 m"
        ],
        [
          "Ball",
          "Größe 5 (430 g)"
        ],
        [
          "Abseits",
          "ja, wie beim 11 gegen 11"
        ],
        [
          "Rückpass",
          "Rückpassregel gilt"
        ],
        [
          "Strafstoß",
          "9 m"
        ],
        [
          "Kader",
          "höchstens 16 (9 Spieler und 7 Wechselspieler)"
        ]
      ],
      "fuss": "Pause 1 und 3 sind Trinkpausen von höchstens 2 Minuten – ohne Seitenwechsel und ohne Nachspielzeit am Ende dieser Viertel. Fortgesetzt wird am Ort der Unterbrechung. Pause 2 ist die klassische Halbzeitpause von 10 Minuten."
    },
    {
      "a": "C-Juniorinnen",
      "k": "Landesklasse",
      "zeit": "2×35 min",
      "feld": "halbes Großfeld",
      "max": 7,
      "min": 5,
      "w": 7,
      "wieder": "möglich",
      "gr": "5 min",
      "t": "< −3 °C"
    },
    {
      "a": "D-Junioren",
      "k": "Spielbetrieb des SVFD (7 gegen 7)",
      "zeit": "3×25 min",
      "feld": "50×30 bis 60×40 m",
      "max": 7,
      "min": 5,
      "w": 7,
      "wieder": "möglich",
      "gr": "KEINE Gelb-Rote Karte",
      "t": "< −6 °C",
      "extra": [
        [
          "Spielform",
          "1 Torhüter und 6 Feldspieler"
        ],
        [
          "Pausen",
          "je höchstens 10 Minuten"
        ],
        [
          "Mittellinienregel",
          "in der Mitte des Spielfeldes"
        ]
      ],
      "fuss": "Das DFBnet kann die Drittel nicht abbilden: alle Angaben – Tore, persönliche Strafen, Wechsel – mit der Spielminute eintragen, keinen Halbzeitstand, und die Nachspielzeit aller Drittel summiert am Ende eingeben."
    },
    {
      "a": "D-Junioren",
      "k": "Landesklasse (Landesebene)",
      "zeit": "3×25 min",
      "feld": "halbes Großfeld",
      "max": 7,
      "min": 5,
      "w": 7,
      "wieder": "möglich",
      "gr": "5 min",
      "t": "< −6 °C",
      "warnung": "Landesebene, also gilt der SFV. Dort weicht zweierlei ab: die Mittellinienregel liegt am gegenüberliegenden Strafraum statt in der Feldmitte, und es gibt sehr wohl eine Gelb-Rote Karte – nur ohne Sperre für das nächste Spiel. Siehe den Reiter „Landesebene Sachsen“."
    },
    {
      "a": "E-Junioren",
      "k": "alle Spielklassen",
      "zeit": "2×25 min",
      "feld": "verkleinertes Kleinfeld",
      "max": 6,
      "min": 4,
      "w": 6,
      "wieder": "möglich",
      "gr": "5 min",
      "t": "< −3 °C",
      "warnung": "Die SFV-Kleinfeldbestimmungen (gültig ab 01.07.2025) sehen für E-Junioren ein Rundensystem vor – bis zu 6 Runden à 10–12 min, ohne Verwarnungen. Vor dem Spiel klären, was in dieser Staffel gilt."
    },
    {
      "a": "F-Junioren",
      "k": "alle Spielklassen",
      "zeit": "2×20 min",
      "feld": "verkleinertes Kleinfeld",
      "max": 6,
      "min": 4,
      "w": 6,
      "wieder": "möglich",
      "gr": "5 min",
      "t": "< −3 °C",
      "warnung": "Die SFV-Kleinfeldbestimmungen sehen für F-Junioren 3 gegen 3 oder 5 gegen 5 im Rundensystem vor, mit Minitoren und ohne Strafstoß."
    },
    {
      "a": "Altherren",
      "k": "Stadtklassen bis Stadtliga",
      "zeit": "2×45 min",
      "feld": "Großfeld",
      "max": 11,
      "min": 7,
      "w": 7,
      "wieder": "nicht möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "Ü40",
      "k": "Breitensport",
      "zeit": "2×40 min",
      "feld": "halbes Großfeld",
      "max": 7,
      "min": 6,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "Ü50",
      "k": "Breitensport",
      "zeit": "2×40 min",
      "feld": "halbes Großfeld",
      "max": 7,
      "min": 6,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    },
    {
      "a": "Ü60",
      "k": "Breitensport",
      "zeit": "2×30 min",
      "feld": "halbes Großfeld",
      "max": 7,
      "min": 6,
      "w": 7,
      "wieder": "möglich",
      "gr": "ja",
      "t": "< −9 °C"
    }
  ],
  "svfdPokal": [
    {
      "a": "Herren",
      "k": "Stadtpokal",
      "zeit": "2×45 min",
      "verl": "2×15 min",
      "elfer": "11 m, 5 Schützen"
    },
    {
      "a": "Frauen",
      "k": "Landespokal",
      "zeit": "2×45 min",
      "verl": "2×15 min",
      "elfer": "11 m, 5 Schützen"
    },
    {
      "a": "Frauen",
      "k": "Sparkassenliga",
      "zeit": "2×45 min",
      "verl": "keine",
      "elfer": "9 m, 3 Schützen"
    },
    {
      "a": "A-Junioren",
      "k": "Stadtpokal, Landespokal",
      "zeit": "2×45 min",
      "verl": "2×15 min",
      "elfer": "11 m, 5 Schützen"
    },
    {
      "a": "B-Junioren",
      "k": "Stadtpokal, Landespokal",
      "zeit": "2×40 min",
      "verl": "2×10 min",
      "elfer": "11 m, 5 Schützen"
    },
    {
      "a": "B-Juniorinnen",
      "k": "Landespokal",
      "zeit": "2×40 min",
      "verl": "2×10 min",
      "elfer": "11 m, 5 Schützen",
      "bes": "siehe Landesliga Großfeld"
    },
    {
      "a": "C-Junioren",
      "k": "Stadtpokal",
      "zeit": "2×40 min in vier Vierteln à 20 min",
      "verl": "2×5 min",
      "elfer": "9 m, 5 Schützen"
    },
    {
      "a": "C-Juniorinnen",
      "k": "Landespokal",
      "zeit": "2×35 min",
      "verl": "2×5 min",
      "elfer": "9 m, 5 Schützen",
      "bes": "verkürztes Großfeld, 9 Spielerinnen, mind. 7, 7 Wechsler"
    },
    {
      "a": "D-Junioren",
      "k": "Stadtpokal",
      "zeit": "3×25 min",
      "verl": "keine Verlängerung, direkt 9-Meter-Entscheidungsschießen",
      "elfer": "9 m, 5 Schützen"
    },
    {
      "a": "D-Juniorinnen",
      "k": "Stadtpokal",
      "zeit": "2×30 min",
      "verl": "keine",
      "elfer": "9 m, 5 Schützen"
    },
    {
      "a": "E-Junioren",
      "k": "Stadtpokal",
      "zeit": "2×25 min",
      "verl": "2×5 min",
      "elfer": "9 m, 5 Schützen"
    },
    {
      "a": "Senioren",
      "k": "Stadtpokal",
      "zeit": "2×45 min",
      "verl": "keine",
      "elfer": "11 m, 5 Schützen"
    },
    {
      "a": "Ü40",
      "k": "Breitensport",
      "zeit": "2×40 min",
      "verl": "keine",
      "elfer": "9 m, 5 Schützen"
    },
    {
      "a": "Ü50",
      "k": "Breitensport",
      "zeit": "2×40 min",
      "verl": "keine",
      "elfer": "9 m, 5 Schützen"
    },
    {
      "a": "Ü60",
      "k": "Breitensport",
      "zeit": "2×30 min",
      "verl": "keine",
      "elfer": "9 m, 5 Schützen"
    }
  ],
  "sfvMeister": [
    {
      "a": "A-Junioren",
      "k": "Sachsenliga",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "2×45 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−9 °C bis +35 °C"
    },
    {
      "a": "A-Junioren",
      "k": "Sachsenklasse",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "2×45 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−9 °C bis +35 °C"
    },
    {
      "a": "B-Junioren",
      "k": "Sachsenliga",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "2×40 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−9 °C bis +35 °C"
    },
    {
      "a": "B-Junioren",
      "k": "Sachsenklasse",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "2×40 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−9 °C bis +35 °C"
    },
    {
      "a": "C-Junioren",
      "k": "Sachsenliga",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "4×20 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−6 °C bis +35 °C",
      "fuss": "Seitenwechsel nur in der 2. Pause. Die 1. und die 3. Pause sind Trinkpausen von höchstens 2 Minuten."
    },
    {
      "a": "C-Junioren",
      "k": "Sachsenklasse",
      "feld": "65×45 bis 75×55 m",
      "sr": "12 × 29 m",
      "tore": "Kleinfeldtore 5 × 2 m",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "9 in der Startformation",
      "zeit": "4×20 min",
      "abseits": "ja",
      "elfer": "9 m",
      "match": "ja",
      "temp": "−6 °C bis +35 °C",
      "fuss": "Seitenwechsel nur in der 2. Pause. Die 1. und die 3. Pause sind Trinkpausen von höchstens 2 Minuten."
    },
    {
      "a": "D-Junioren",
      "k": "Sachsenliga",
      "feld": "50×30 bis 60×40 m",
      "sr": "10 × 25 m",
      "tore": "Kleinfeldtore 5 × 2 m",
      "ball": "Leichtspielball Größe 5 (350 g)",
      "spieler": "7 in der Startformation",
      "zeit": "3×25 min",
      "abseits": "nein",
      "elfer": "9 m",
      "match": "ja, aber ohne Sperre für das darauffolgende Spiel",
      "temp": "−6 °C bis +32 °C"
    },
    {
      "a": "D-Junioren",
      "k": "Sachsenklasse",
      "feld": "50×30 bis 60×40 m",
      "sr": "10 × 25 m",
      "tore": "Kleinfeldtore 5 × 2 m",
      "ball": "Leichtspielball Größe 5 (350 g)",
      "spieler": "7 in der Startformation",
      "zeit": "3×25 min",
      "abseits": "nein",
      "elfer": "9 m",
      "match": "ja, aber ohne Sperre für das darauffolgende Spiel",
      "temp": "−6 °C bis +32 °C"
    }
  ],
  "sfvPokal": [
    {
      "a": "A-Junioren",
      "k": "Landespokal",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "2×45 min",
      "verl": "2×15 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−9 °C bis +35 °C"
    },
    {
      "a": "B-Junioren",
      "k": "Landespokal",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "2×40 min",
      "verl": "2×10 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−9 °C bis +35 °C"
    },
    {
      "a": "C-Junioren",
      "k": "Landespokal",
      "feld": "90×45 bis 120×90 m",
      "sr": "16,5 × 40 m",
      "tore": "Großfeldtore",
      "ball": "Normalspielball Größe 5 (430 g)",
      "spieler": "11 in der Startformation",
      "zeit": "4×20 min",
      "verl": "2×5 min",
      "abseits": "ja",
      "elfer": "11 m",
      "match": "ja",
      "temp": "−6 °C bis +35 °C",
      "fuss": "Seitenwechsel nur in der 2. Pause. Die 1. und die 3. Pause sind Trinkpausen von höchstens 2 Minuten."
    },
    {
      "a": "D-Junioren",
      "k": "Landespokal",
      "feld": "50×30 bis 60×40 m",
      "sr": "10 × 25 m",
      "tore": "Kleinfeldtore 5 × 2 m",
      "ball": "Leichtspielball Größe 5 (350 g)",
      "spieler": "7 in der Startformation",
      "zeit": "3×25 min",
      "verl": "keine Verlängerung, sofort Entscheidungsschießen",
      "abseits": "nein",
      "elfer": "9 m",
      "match": "ja, aber ohne Sperre für das darauffolgende Spiel",
      "temp": "−6 °C bis +32 °C"
    }
  ],
  "sfvWechselspieler": "7 auf dem Spielbericht",
  "sfvRueckwechsel": "möglich, unbegrenzt viele Wechselvorgänge",
  "bereiche": [
    {
      "id": "aktive",
      "titel": "Herren & Frauen",
      "klassen": [
        "Herren",
        "Frauen",
        "Senioren"
      ]
    },
    {
      "id": "junioren",
      "titel": "Junioren",
      "klassen": [
        "A-Junioren",
        "B-Junioren",
        "C-Junioren",
        "D-Junioren",
        "E-Junioren",
        "F-Junioren"
      ]
    },
    {
      "id": "juniorinnen",
      "titel": "Juniorinnen",
      "klassen": [
        "B-Juniorinnen",
        "C-Juniorinnen",
        "D-Juniorinnen"
      ]
    },
    {
      "id": "alt",
      "titel": "Altherren & Ü",
      "klassen": [
        "Altherren",
        "Ü40",
        "Ü50",
        "Ü60"
      ]
    }
  ]
};

export const VORLAGEN_STANDARD = {
  "schemaVersion": 1,
  "spiel": {
    "titel": "E-Mail an den Ansetzer",
    "text": "An: sr-ansetzer@svf-dresden.de\nCc: [E-Mail eures Obmanns]\nBetreff: Absage Ansetzung – Spielkennung [XXXXXXX], [TT.MM.JJJJ]\n\nHallo liebes Ansetzer-Team,\n\nich bitte um die Absetzung von folgendem Spiel:\n\n- Begegnung: [Heimverein] – [Gastverein]\n- Spielkennung: [aus DFBnet]\n- Datum: [TT.MM.JJJJ]\n- Uhrzeit: [HH:MM Uhr]\n- Wettbewerb: [z. B. Meisterschaft, Pokal ...]\n- Liga: [z. B. Landesklasse ...]\n- Meine Funktion: [Schiedsrichter / 1. Assistent / 2. Assistent]\n\nGrund: [kurz und konkret]\n\nViele Grüße",
    "hinweis": "Bist du nach 24 Stunden nicht abgesetzt, ruf beim Ansetzer an. Du bleibst für das Spiel zuständig, bis du tatsächlich abgesetzt wurdest – die Mail allein reicht nicht.",
    "quelle": "Anweisung des Stadtverbands Fußball Dresden e. V. an Schiedsrichter/-innen, Beobachter und Paten, gültig ab 20.08.2026, Ergänzung SRO §8 Punkt 7.",
    "entwurf": false
  },
  "lehrabend": {
    "titel": "E-Mail an den Obmann",
    "text": "An: [E-Mail eures Obmanns]\nBetreff: Absage Regellehrabend am [TT.MM.JJJJ]\n\nHallo,\n\nich kann am Regellehrabend am [TT.MM.JJJJ] leider nicht teilnehmen.\n\nGrund: [kurz und konkret]\n\nViele Grüße\n[Vorname Nachname]",
    "hinweis": "Entwurf – Wortlaut noch nicht abgestimmt. Ob und bis wann eine Absage eingereicht werden muss, steht in der Einladung zum jeweiligen Abend.",
    "quelle": "",
    "entwurf": true
  }
};

export const UNTERLAGEN_STANDARD = {
  "schemaVersion": 1,
  "herkunft": {
    "hier": {
      "text": "Bei uns",
      "klasse": "abz-hier",
      "symbol": "hier",
      "extern": false
    },
    "svfd": {
      "text": "Stadtverband",
      "klasse": "abz-extern",
      "symbol": "extern",
      "extern": true
    },
    "sfv": {
      "text": "Landesverband",
      "klasse": "abz-land",
      "symbol": "land",
      "extern": true
    }
  },
  "gruppen": [
    {
      "id": "vor",
      "titel": "Vor dem Spiel",
      "kurz": "Vor dem Spiel"
    },
    {
      "id": "nach",
      "titel": "Nach dem Spiel",
      "kurz": "Nach dem Spiel"
    },
    {
      "id": "lernen",
      "titel": "Zum Lernen",
      "kurz": "Lernen"
    },
    {
      "id": "vorfall",
      "titel": "Wenn etwas passiert",
      "kurz": "Vorfälle"
    }
  ],
  "dokumente": [
    {
      "id": "dokument-1",
      "aktiv": true,
      "g": "vor",
      "titel": "Kurzübersicht Regeln des Stadtverbands",
      "sub": "Das Original zu unserer Tabelle. Weiterhin die Fassung von 2024 – für C- und D-Junioren gilt die Handreichung darüber.",
      "href": "https://www.svf-dresden.de/docs/schiedsrichter/regelwerk/kurzuebersicht-regeln/",
      "q": "svfd"
    },
    {
      "id": "dokument-2",
      "aktiv": true,
      "g": "vor",
      "titel": "Handreichung des SVFD 2025/2026",
      "sub": "Was in Dresden bei C- und D-Junioren gilt: 9 gegen 9, Viertel statt Halbzeiten, Mittellinienregel in der Feldmitte – und in den D-Junioren gibt es KEINE Gelb-Rote Karte.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-3",
      "aktiv": true,
      "g": "vor",
      "titel": "Kapitänsregelung",
      "sub": "Wer mit dem Schiedsrichter sprechen darf und wer nicht.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-4",
      "aktiv": true,
      "g": "vor",
      "titel": "Spielberechtigungen prüfen",
      "sub": "Was vor dem Anpfiff kontrolliert wird und was bei Unstimmigkeiten gilt.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-5",
      "aktiv": true,
      "g": "nach",
      "titel": "Wiedereinwechslungen eintragen",
      "sub": "Klickanleitung für den Spielbericht – wo genau man was einträgt.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-6",
      "aktiv": true,
      "g": "nach",
      "titel": "Spesenquittung (Formular)",
      "sub": "Das Originalformular des Stadtverbands zum Ausdrucken.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-7",
      "aktiv": true,
      "g": "lernen",
      "titel": "Hausregeltest",
      "sub": "Fragen, Lösungen und die Antwortvorlage. Antworten kurz halten, persönliche Strafen und Spielstrafen nennen, Regelheft ist erlaubt.",
      "href": "https://www.svf-dresden.de/docs/schiedsrichter/hausregeltest/",
      "q": "svfd"
    },
    {
      "id": "dokument-8",
      "aktiv": true,
      "g": "lernen",
      "titel": "DFB-Fußballregeln",
      "sub": "Das vollständige Regelwerk der laufenden Saison.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-9",
      "aktiv": true,
      "g": "lernen",
      "titel": "Regeländerungen",
      "sub": "Was sich zu dieser Saison geändert hat.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-10",
      "aktiv": true,
      "g": "vor",
      "titel": "Regelungsübersicht Junioren 2026/27",
      "sub": "Spielzeit, Feldmaße, Ball, Abseits und Temperaturgrenzen für Sachsenliga, Sachsenklasse und Landespokal. Stand 01.07.2026 – aktueller als unsere Tabelle.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Spielbetrieb/Junioren/Saison_2026_2027/regelungsuebersicht.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-11",
      "aktiv": true,
      "g": "vor",
      "titel": "Kleinfeldbestimmungen",
      "sub": "Maße, Torgrößen und Sonderregeln von G- bis C-Junioren. Achtung: Freistoßabstand 3 bzw. 5 Meter statt 9,15.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Spielbetrieb/Regelwerk/kleinfeldbestimmungen.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-12",
      "aktiv": true,
      "g": "vor",
      "titel": "Altersklassen 2026/27",
      "sub": "Welcher Jahrgang spielt in welcher Altersklasse.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Spielbetrieb/03062026_altersklassen_neu.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-13",
      "aktiv": true,
      "g": "vor",
      "titel": "Spieldurchführung Frauen und Juniorinnen 2026/27",
      "sub": "Das Gegenstück zur Junioren-Übersicht.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Spielbetrieb/Frauen_Juniorinnen/Saison_2026_2027/08042026_Uebersicht_Spielbetrieb_FMA.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-14",
      "aktiv": true,
      "g": "nach",
      "titel": "Spielbericht Online – Anleitung für Schiedsrichter",
      "sub": "Arbeiten nach dem Spiel und Freigabe. Nicht die Vereinsanleitung, sondern unsere.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/DFBnet/Spielbericht_Online/Spielbericht_Online_Anleitung_Schiedsrichter.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-15",
      "aktiv": true,
      "g": "nach",
      "titel": "Reisekostenabrechnung SFV",
      "sub": "Das Formular für Einsätze auf Landesebene.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Schiedsrichter/SR-Abrechnung_SFV_formularneu.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-16",
      "aktiv": true,
      "g": "nach",
      "titel": "Finanzordnung des SFV",
      "sub": "Entschädigungssätze aller Landesklassen und die Reisekostenregeln (§ 8, § 13). Auch: bei Spielausfall gibt es 50 Prozent.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Satzung_Ordnungen/07312025_Finanzordnung.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-17",
      "aktiv": true,
      "g": "vorfall",
      "titel": "Handlungsempfehlungen bei Diskriminierung",
      "sub": "Was zu tun ist, wenn es von Spielern oder von den Zuschauern kommt – und was in den Sonderbericht gehört. Meldeadresse: fairness@sfv-online.de",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Sicherheit/08312021_Handlungsempfehlungen.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-18",
      "aktiv": true,
      "g": "vorfall",
      "titel": "Vorlage Sonderbericht",
      "sub": "Wer hat was gegen wen gesagt oder getan, wo stand die Person, was hast du veranlasst. Word-Datei – wird heruntergeladen, nicht angezeigt.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Schiedsrichter/02202024_vorlage_sonderbericht.docx",
      "q": "sfv"
    },
    {
      "id": "dokument-19",
      "aktiv": true,
      "g": "vorfall",
      "titel": "Meldeformular Gewalt und Rassismus",
      "sub": "Sofortmeldung an den Verband.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Sicherheit/sofortinfo_gewalt_rassismus.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-20",
      "aktiv": true,
      "g": "vorfall",
      "titel": "Umgang mit Diskriminierung und Gewalt",
      "sub": "Die Handreichung des Stadtverbands dazu.",
      "href": "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
      "q": "svfd"
    },
    {
      "id": "dokument-21",
      "aktiv": true,
      "g": "lernen",
      "titel": "Qualifikationsrichtlinie Schiedsrichter 2026/27",
      "sub": "Was für welche Spielklasse verlangt wird.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Schiedsrichter/Saison_2025_2026/Quali-RL_26_27.pdf",
      "q": "sfv"
    },
    {
      "id": "dokument-22",
      "aktiv": true,
      "g": "lernen",
      "titel": "Rahmenterminplan Junioren 2026/27",
      "sub": "Spielfreie Wochenenden, Pokalrunden und Staffeltermine.",
      "href": "https://www.sfv-online.de/fileadmin/content/PDFs/Spielbetrieb/Junioren/Saison_2026_2027/04202026_rtp_junioren.pdf",
      "q": "sfv"
    }
  ]
};

