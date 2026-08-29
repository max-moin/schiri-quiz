-- v92_medium_und_antworttyp (29.08.2026)
--
-- Max hat einen Fehler im Datenmodell benannt: "dass man so einen
-- Fragetyp hat: Ist das ein Video, oder ist das eine Formulierung? Und
-- dass man einen Antworttyp mit Multiple Choice, Freitext und diesem
-- Szenario-Ding hat."
--
-- Er hat recht. In "fragen.typ" stecken zwei Achsen zusammengefaltet:
-- multiple_choice, freitext, video_mc, video_freitext, szenario. Deshalb
-- heisst eine davon "video_mc" und nicht einfach "video" - das "_mc" ist
-- die zweite Achse, die sich in den Namen gedraengt hat.
--
-- Richtig ist:
--   medium      = text | video | bild        (womit wird gefragt)
--   antworttyp  = multiple_choice | freitext | entscheidung | mehrfachauswahl
--
-- Max ausdruecklich: "Das wuerde ich jetzt schon umbauen, weil sonst das
-- spaeter ja noch ein groesseres Umbauproblem geben wird."
--
-- ============================================================
--  Die entscheidende Randbedingung: die App darf nicht stehenbleiben
-- ============================================================
--
-- obmann_frage_erstellen und obmann_frage_bearbeiten nehmen heute einen
-- Parameter p_typ, und die Swift-App schickt ihn. Wuerde ich deren
-- Signatur aendern, liessen sich Fragen bis zum Nachziehen der App gar
-- nicht mehr anlegen (PGRST202, die Lektion aus v85).
--
-- Deshalb: "typ" bleibt, und ein Trigger haelt beide Seiten deckungs-
-- gleich. Wer "typ" schreibt (die App), bekommt medium/antworttyp
-- abgeleitet. Wer die neuen Spalten schreibt (die Website, spaeter die
-- neue App-Fassung), bekommt "typ" abgeleitet - fuer Kombinationen ohne
-- genauen Altnamen den naechstliegenden, damit die alte App nie ein
-- Feld sieht, mit dem sie nichts anfangen kann.

-- ============================================================
--  1. Die beiden neuen Spalten
-- ============================================================

alter table public.fragen
  add column if not exists medium     text,
  add column if not exists antworttyp text;

-- Aus dem alten typ befuellen. Einmalig, danach macht das der Trigger.
update public.fragen set
  medium = case typ
    when 'video_mc' then 'video' when 'video_freitext' then 'video'
    when 'szenario' then 'bild' else 'text' end,
  antworttyp = case typ
    when 'freitext' then 'freitext' when 'video_freitext' then 'freitext'
    when 'szenario' then 'entscheidung' else 'multiple_choice' end
where medium is null or antworttyp is null;

alter table public.fragen
  alter column medium     set not null,
  alter column medium     set default 'text',
  alter column antworttyp set not null,
  alter column antworttyp set default 'multiple_choice';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fragen_medium_gueltig') then
    alter table public.fragen add constraint fragen_medium_gueltig
      check (medium in ('text', 'video', 'bild'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fragen_antworttyp_gueltig') then
    alter table public.fragen add constraint fragen_antworttyp_gueltig
      check (antworttyp in ('multiple_choice', 'freitext', 'entscheidung', 'mehrfachauswahl'));
  end if;
end $$;

comment on column public.fragen.medium is
  'Womit gefragt wird: text | video | bild. Zusammen mit antworttyp der Ersatz fuer die alte Spalte typ.';
comment on column public.fragen.antworttyp is
  'Wie geantwortet wird: multiple_choice | freitext | entscheidung | mehrfachauswahl. "entscheidung" ist der Icon-Modus (Spielfortsetzung + persoenliche Strafe).';
comment on column public.fragen.typ is
  'VERALTET seit v92 (29.08.2026). Wird per Trigger mit medium/antworttyp deckungsgleich gehalten, damit die Swift-App weiterlaeuft. Neuer Code liest medium und antworttyp. Entfaellt, wenn nichts mehr darauf zeigt.';

-- ============================================================
--  2. Trigger, der beide Seiten deckungsgleich haelt
-- ============================================================

create or replace function public.fragen_typ_ableiten()
returns trigger
language plpgsql
set search_path to public
as $function$
declare
  v_typ text;
begin
  -- Legacy-Name fuer die aktuelle Kombination, oder NULL wenn es keinen gibt.
  -- Immer ein Wert, nie NULL: "typ" ist NOT NULL, und ein alter Leser
  -- (Swift-App) kaeme mit einem leeren Feld ohnehin nicht klar. Fuer
  -- Kombinationen ohne genauen Altnamen wird deshalb der naechst-
  -- liegende genommen - die alte App zeigt eine Bildfrage dann eben als
  -- Multiple Choice und ignoriert das Bild, statt zu stolpern.
  --
  -- Im ersten Entwurf stand hier NULL. Das ist beim Test sofort an der
  -- NOT-NULL-Regel gescheitert (29.08.2026) - und der Rueckfallwert ist
  -- die bessere Loesung, nicht nur die noetige.
  v_typ := case
    when new.antworttyp = 'entscheidung'                             then 'szenario'
    when new.medium = 'video' and new.antworttyp = 'freitext'        then 'video_freitext'
    when new.medium = 'video'                                        then 'video_mc'
    when new.antworttyp = 'freitext'                                 then 'freitext'
    else 'multiple_choice' end;

  if tg_op = 'INSERT' then
    -- Kein medium/antworttyp mitgeschickt: der Aufrufer ist alt und
    -- denkt in "typ". Dann aus typ ableiten.
    if new.medium is null or new.antworttyp is null then
      new.medium := case new.typ
        when 'video_mc' then 'video' when 'video_freitext' then 'video'
        when 'szenario' then 'bild' else 'text' end;
      new.antworttyp := case new.typ
        when 'freitext' then 'freitext' when 'video_freitext' then 'freitext'
        when 'szenario' then 'entscheidung' else 'multiple_choice' end;
    else
      new.typ := v_typ;
    end if;
    return new;
  end if;

  -- UPDATE: wer hat sich bewegt?
  if new.typ is distinct from old.typ
     and new.medium is not distinct from old.medium
     and new.antworttyp is not distinct from old.antworttyp then
    -- Nur typ geaendert -> alter Aufrufer, neue Spalten nachziehen.
    new.medium := case new.typ
      when 'video_mc' then 'video' when 'video_freitext' then 'video'
      when 'szenario' then 'bild' else 'text' end;
    new.antworttyp := case new.typ
      when 'freitext' then 'freitext' when 'video_freitext' then 'freitext'
      when 'szenario' then 'entscheidung' else 'multiple_choice' end;
  else
    new.typ := v_typ;
  end if;

  return new;
end;
$function$;

drop trigger if exists fragen_typ_abgleich on public.fragen;
create trigger fragen_typ_abgleich
  before insert or update on public.fragen
  for each row execute function public.fragen_typ_ableiten();

-- Die alte Pruefregel auf typ wird ersetzt. Der erste Entwurf wollte
-- NULL zulassen, weil es fuer Kombinationen ohne Altnamen (z.B. Bild +
-- Multiple Choice) keinen gibt. Das ist an NOT NULL gescheitert und war
-- ohnehin die schlechtere Loesung - jetzt bekommt jede Kombination den
-- naechstliegenden Altnamen (siehe Kommentar am Trigger).
-- Ausdruecklich beim Namen genannt statt per Mustersuche. Ein erster
-- Entwurf suchte die Regel ueber ILIKE '%typ%multiple_choice%' - das
-- trifft auch fragen_video_antworttyp_check, und "select into" haette
-- sich dann eine der beiden ausgesucht. Beinahe die falsche Pruefregel
-- geloescht (bemerkt am 29.08.2026 beim Nachsehen in pg_constraint).
alter table public.fragen drop constraint if exists fragen_typ_check;

alter table public.fragen add constraint fragen_typ_gueltig
  check (typ in ('multiple_choice', 'video_mc', 'video_freitext', 'freitext', 'szenario'));
