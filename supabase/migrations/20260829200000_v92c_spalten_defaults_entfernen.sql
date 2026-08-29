-- v92c_spalten_defaults_entfernen (29.08.2026)
--
-- Nachtrag zu v92. Der gefaehrlichste Fehler des Tages, gefunden erst
-- durch die Pruefung Nr. 2 der Testreihe - nicht beim Lesen des Codes.
--
-- ============================================================
--  Was passiert waere
-- ============================================================
--
-- v92 hat medium und antworttyp mit DEFAULT angelegt:
--     alter column medium     set default 'text'
--     alter column antworttyp set default 'multiple_choice'
--
-- Der Trigger fragen_typ_ableiten() unterscheidet den alten vom neuen
-- Aufrufer daran, ob medium/antworttyp NULL sind:
--
--     if new.medium is null or new.antworttyp is null then
--         -- alter Aufrufer: aus typ ableiten
--     else
--         new.typ := v_typ;   -- neuer Aufrufer: typ ableiten
--     end if;
--
-- Spalten-Defaults werden aber gesetzt, BEVOR der BEFORE-Trigger
-- laeuft. Damit waren die beiden Felder im Trigger nie NULL. Der
-- Trigger hat also jeden INSERT fuer einen neuen Aufrufer gehalten und
-- new.typ aus den Defaults abgeleitet.
--
-- Konkret: die Swift-App schickt p_typ = 'video_freitext' und sonst
-- nichts. Der Datensatz waere als text / multiple_choice / multiple_choice
-- gelandet. Ohne Fehlermeldung. Jede neu in der App angelegte
-- Videofrage waere still zu einer normalen Multiple-Choice-Frage
-- geworden, das Video verwaist.
--
-- ============================================================
--  Warum das Entfernen sicher ist
-- ============================================================
--
-- Beide Spalten bleiben NOT NULL. Das ist kein Widerspruch: NOT NULL
-- wird nach den BEFORE-Triggern geprueft, und der Trigger setzt in
-- genau dem Fall, in dem die Felder leer ankommen, beide Werte. Ein
-- INSERT ganz ohne Angaben (ganz alter Aufrufer, nur frage_text) fuellt
-- ueber den Default von typ = 'multiple_choice' korrekt text /
-- multiple_choice.
--
-- Merksatz fuer spaeter: ein Spalten-Default und ein BEFORE-Trigger,
-- der "wurde das Feld mitgeschickt?" an NULL erkennt, schliessen
-- einander aus. Der Default gewinnt immer, und der Trigger merkt es
-- nicht.

alter table public.fragen alter column medium     drop default;
alter table public.fragen alter column antworttyp drop default;

comment on column public.fragen.medium is
  'Womit gefragt wird: text | video | bild. Absichtlich OHNE Spalten-Default: der Trigger fragen_typ_ableiten() erkennt an NULL, dass ein alter Aufrufer nur typ geschickt hat. Ein Default wuerde diese Unterscheidung zerstoeren (siehe v92c).';
comment on column public.fragen.antworttyp is
  'Wie geantwortet wird: multiple_choice | freitext | entscheidung | mehrfachauswahl. "entscheidung" ist der Icon-Modus (Spielfortsetzung + persoenliche Strafe). Absichtlich OHNE Spalten-Default, siehe v92c.';
