# ============================================================
#  UI-Pruefung: Datenzustaende (gemockte Server-Antworten)
# ============================================================
#  Die Pruefung spricht NIE mit der echten Datenbank. Jeder Aufruf von
#  /rest/v1/rpc/<name> wird im Browser abgefangen und mit den Daten aus
#  diesem Modul beantwortet (unbekannte Namen -> leere Liste []).
#
#  Ein Zustand = ein Name, eine Sitzung (oder keine) und ein Woerterbuch
#  RPC-Name -> Antwort. Neuen Zustand anlegen: unten in ZUSTAENDE
#  eintragen; pruefen.py --zustaende <name> waehlt ihn aus.
#
#  Die Termine liegen relativ zu "heute", damit Fristen, "laeuft gerade"
#  und "vergangen" bei jedem Lauf dieselbe Lage zeigen.
# ============================================================
from datetime import date, timedelta

heute = date.today()
d = lambda n: (heute + timedelta(days=n)).isoformat()
TERMINE = [
 {"id":"t1","titel":"Soccer-Golf-Event","datum":d(22),"beginn_zeit":"12:00:00","ende_zeit":"15:00:00","ort":"Ottendorf-Okrilla","art":"event","pflicht":False,
  "rueckmeldung_bis":d(-1),"rueckmeldung_erforderlich":True,"vergangen":False,"mein_status":None,"mein_grund":None,"mein_kommentar":None,"zusagen":3,"absagen":1,
  "eigener_verein":True,"termin_verein_id":"v","termin_verein_name":"FV","laeuft":False,"rueckmeldefrist_abgelaufen":True,"zusage_moeglich":False,"absage_moeglich":True,"beschreibung":None},
 {"id":"t2","titel":"SR-Treff 10/26","datum":d(17),"beginn_zeit":"18:00:00","ende_zeit":"19:30:00","ort":"Vereinsraum","art":"treff","pflicht":True,
  "rueckmeldung_bis":None,"rueckmeldung_erforderlich":True,"vergangen":False,"mein_status":None,"mein_grund":None,"mein_kommentar":None,"zusagen":2,"absagen":0,
  "eigener_verein":True,"termin_verein_id":"v","termin_verein_name":"FV","laeuft":False,"rueckmeldefrist_abgelaufen":False,"zusage_moeglich":True,"absage_moeglich":True,"beschreibung":None},
 {"id":"t3","titel":"Obmann Treff","datum":heute.isoformat(),"beginn_zeit":"00:01:00","ende_zeit":"23:58:00","ort":"Jägerpark","art":"sonstiges","pflicht":False,
  "rueckmeldung_bis":None,"rueckmeldung_erforderlich":True,"vergangen":False,"mein_status":None,"mein_grund":None,"mein_kommentar":None,"zusagen":0,"absagen":0,
  "eigener_verein":True,"termin_verein_id":"v","termin_verein_name":"FV","laeuft":True,"rueckmeldefrist_abgelaufen":False,"zusage_moeglich":False,"absage_moeglich":False,"beschreibung":None},
 {"id":"t4","titel":"Regellehrabend","datum":d(-3),"beginn_zeit":"18:00:00","ende_zeit":"20:00:00","ort":"JOYNEXT Arena","art":"lehrabend","pflicht":True,
  "rueckmeldung_bis":None,"rueckmeldung_erforderlich":True,"vergangen":True,"mein_status":"zu","mein_grund":None,"mein_kommentar":None,"zusagen":5,"absagen":1,
  "eigener_verein":True,"termin_verein_id":"v","termin_verein_name":"FV","laeuft":False,"rueckmeldefrist_abgelaufen":False,"zusage_moeglich":False,"absage_moeglich":False,"beschreibung":None},
]
FINDUNGEN = [{"id":"f1","titel":"Termin für den Weihnachtstreff","beschreibung":"Welcher Abend passt?","antwort_bis":d(-2),"status":"offen","gewaehlter_vorschlag":None,
  "erstellt_am":d(-10),"frist_abgelaufen":True,"vorschlaege":[{"id":"v1","datum":d(60),"beginn_zeit":"18:00:00","ort":None,"position":1,"meine_antwort":"ja","ja":4,"vielleicht":1,"nein":0},
  {"id":"v2","datum":d(62),"beginn_zeit":"18:00:00","ort":None,"position":2,"meine_antwort":None,"ja":2,"vielleicht":0,"nein":2}]}]
MELDUNGEN = [{"meldung_id":"m1","frage_id":"q","frage_nummer":3,"frage_text":"Ein Verteidiger spielt den Ball absichtlich mit der Hand ...","runde_bezeichnung":"KW 38","status":"erledigt",
  "anzahl_eintraege":1,"erstellt_am":d(-4)+"T10:00:00Z","aktualisiert_am":heute.isoformat()+"T08:00:00Z",
  "eintraege":[{"id":"e1","kategorie":"loesung","text":"Ich glaube, die Lösung ist falsch – es müsste indirekter Freistoß sein.","status":"erledigt","erledigt":True,
  "rueckmeldung_obmann":"Danke, du hast recht. Die Lösung ist korrigiert und deine Antwort zählt jetzt als richtig.","rueckmeldung_am":heute.isoformat()+"T08:00:00Z","rueckmeldung_neu":True,"erstellt_am":d(-4)+"T10:00:00Z"}]}]
ANTWORTEN = {"oeffentliche_termine_alle":[], "termine_fuer_schiri_v2":TERMINE, "terminfindungen_fuer_schiri":FINDUNGEN, "meine_termin_vorschlaege":[],
  "meine_frage_meldungen":MELDUNGEN, "schiri_anfragen_liste":[], "schiri_prozess_liste":[], "schiri_fragenvorschlaege_liste":[], "meine_neuen_antworten":1,
  "schiri_anfragen_als_gesehen_markieren":None, "meine_antworten_gelesen":1, "oeffentliche_termine":[]}

FRAGEN = [
 {"id":"f1","frage_text":"Ein Spieler schießt den Ball absichtlich an den Arm des Gegners. Entscheidung und Begründung?","antworttyp":"freitext","typ":"freitext","medium":"text","frage_nummer":1,"position":1},
 {"id":"f2","frage_text":"Wie weit ist die Strafstoßmarke von der Torlinie entfernt?","antworttyp":"zahl","typ":"multiple_choice","medium":"text","frage_nummer":2,"position":2,"zahl_einheiten":[{"einheit":"m"},{"einheit":"Yards"}]},
 {"id":"f3","frage_text":"Der Torwart verlässt vor dem Strafstoß die Linie, der Ball geht daneben. Entscheidung?","antworttyp":"entscheidung","typ":"multiple_choice","medium":"text","frage_nummer":3,"position":3,
  "fordert_fortsetzung":True,"fordert_fortsetzung_fuer":True,"fordert_fortsetzung_ort":True,"fordert_strafe":True,"fordert_strafe_mannschaft":True,"fordert_strafe_rolle":False,"fordert_strafe_nummer":False,"zeigt_trikotfarben":False},
]

SITZUNG = {"id": "s1", "pin": "1234", "name": "Max M.", "kennung": "x"}

ZUSTAENDE = {
    # Niemand angemeldet: oeffentliche Seiten, Anmeldemasken.
    "abgemeldet": {
        "sitzung": None,
        "rpc": {"oeffentliche_termine": [], "oeffentliche_termine_alle": []},
    },
    # Angemeldeter Schiri mit allem, was Seiten gern zeigen: Frist
    # abgelaufen, Termin laeuft, neue Antwort vom Obmann, drei Fragen.
    "angemeldet": {
        "sitzung": SITZUNG,
        "rpc": {**ANTWORTEN, "wochen_fragen_v2": FRAGEN, "meine_antworten_v2": []},
    },
}
