-- v82_termine_oeffentlich (22.08.2026)
--
-- Die oeffentliche Vereinsseite soll die naechsten Termine anzeigen, aber
-- nicht alle. In "termine" stehen auch interne Sachen - Obmannbesprechung,
-- Planungsrunden, Notizen. Deshalb bekommt jede Zeile einen Schalter, der
-- ausdruecklich gesetzt werden muss.
--
-- Bewusst "default false": Wer nichts tut, veroeffentlicht nichts. Ein
-- Schalter mit "default true" haette rueckwirkend jeden bestehenden Termin
-- ins Netz gestellt.

alter table public.termine
  add column if not exists oeffentlich boolean not null default false;

comment on column public.termine.oeffentlich is
  'true = Termin darf auf der oeffentlichen Vereinsseite erscheinen. '
  'Wird im Obmann-Dashboard gesetzt, nie automatisch.';

-- Teilindex statt Vollindex: die oeffentlichen Termine sind eine kleine
-- Minderheit, und genau nach ihnen wird von aussen gefragt.
create index if not exists termine_oeffentlich_idx
  on public.termine (verein_id, datum)
  where oeffentlich;
