-- v161: Deckt den Fremdschluessel der Versandauftraege auf die Empfaenger-
-- einstellungen ab. Relevant beim spaeteren Sperren oder Entfernen eines
-- Benachrichtigungsempfaengers.

create index if not exists benachrichtigungs_auftraege_empfaenger_idx
  on public.benachrichtigungs_auftraege (empfaenger_schluessel);
