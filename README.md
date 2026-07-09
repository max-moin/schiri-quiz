# ⚽ Schiri-Quiz der Woche

Eine kleine Website für die Schiedsrichter:innen unseres Vereins: einmal pro Woche ein paar Regelfragen beantworten, direkt im Browser, dauert unter 2 Minuten.

## Was das hier ist

Das ist ein **Vibe-Coding-Projekt** – ich (Max, Schiedsrichter-Obmann des Vereins) habe das zusammen mit [Claude](https://claude.ai) gebaut, ohne selbst schon tief in Webentwicklung drinzustecken. Die Idee, die Architektur-Entscheidungen und alle Inhalte (Fragen, Regeln, Abläufe) kommen von mir; den eigentlichen Code hat Claude geschrieben, ich habe getestet, Feedback gegeben und angepasst. Nebenbei ist das für mich auch ein Einstieg, um Programmieren besser zu verstehen – deswegen ist der Code bewusst einfach gehalten (kein Build-Tool, kein Framework, nur HTML/CSS/JS).

**Aktueller Stand: Testphase.** Die eigentlichen Schiedsrichter:innen des Vereins nutzen das noch nicht aktiv – erstmal wird alles selbst durchgetestet, bevor es "scharf" geschaltet wird.

## Was die Seite macht

- Schiedsrichter:in wählt sich per Name + PIN aus einer Liste aus
- beantwortet die aktuellen Wochenfragen (Multiple Choice, direktes Richtig/Falsch-Feedback)
- bereits beantwortete Fragen werden beim nächsten Besuch automatisch gesperrt angezeigt (kein doppeltes Beantworten)
- ein Obmann-Dashboard (separate App, siehe unten) wertet aus, wer wie gut abgeschnitten hat

## Tech-Stack

- **Frontend:** einfaches HTML/CSS/JavaScript, kein Framework, kein Build-Schritt – die drei Dateien `index.html`, `style.css`, `app.js` sind der komplette Code
- **Backend/Datenbank:** [Supabase](https://supabase.com) (Postgres + automatisch generierte API). Die Fragen-Logik, PIN-Prüfung usw. läuft über Postgres-Funktionen (RPCs), nicht im Frontend
- **Hosting:** [Vercel](https://vercel.com), automatisches Deployment bei jedem Push auf `main`

## Sicherheitsmodell (kurz)

Der `SUPABASE_ANON_KEY` in `config.js` ist **absichtlich öffentlich** – das ist bei Supabase so vorgesehen, jeder Website-Besucher bekommt diesen Key ohnehin im Browser zu sehen. Der eigentliche Schutz kommt aus zwei Dingen:

1. **Row-Level-Security** (siehe `supabase-schema.sql`) – regelt, wer welche Tabellen/Zeilen überhaupt sehen/ändern darf
2. **PIN-Prüfung serverseitig** in den Postgres-Funktionen (nicht im Frontend) – eine falsche PIN wird immer vom Server abgelehnt, egal was das Frontend schickt

Der geheime `service_role`-Key taucht hier nirgends auf und darf auch nie im Frontend-Code landen.

## Verwandtes Projekt

Es gibt außerdem eine SwiftUI-App ("SR-Obmann") für Mac/iPad/iPhone, mit der ich als Obmann die Auswertungen sehe, neue Fragen anlege und die Wochenplanung mache – nutzt dieselbe Supabase-Datenbank, ist aber ein eigenes, separates Repository.

## Weiteres

Eine ausführlichere technische Anleitung (Supabase/Vercel von Grund auf einrichten) steht in [`ANLEITUNG.md`](./ANLEITUNG.md).
