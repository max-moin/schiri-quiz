-- Ergaenzt die gemeinsamen Quiz-/Planungsrunden bis einschliesslich
-- Kalenderwoche 27.12.2027-03.01.2028. Bereits vorhandene Runden bleiben
-- unveraendert; die Migration ist auch nach dem Live-Hotfix idempotent.
-- Die Wochen wechseln wie bisher montags um 10:00 Uhr in Europe/Berlin.
with kandidaten as (
  select g::date as montag,
         ((g::date + time '10:00') at time zone 'Europe/Berlin') as start_zeit,
         (((g::date + 7) + time '10:00') at time zone 'Europe/Berlin') as end_zeit
  from generate_series(date '2026-10-05', date '2027-12-27', interval '7 days') as g
)
insert into public.runden (bezeichnung, startet_am, endet_am)
select to_char(k.montag, 'DD.MM.') || '-' || to_char(k.montag + 7, 'DD.MM.YYYY'),
       k.start_zeit,
       k.end_zeit
from kandidaten k
where not exists (
  select 1 from public.runden r where r.startet_am = k.start_zeit
);
