-- ============================================================
--  v138 - Der Bereich "bilder" darf gespeichert werden
-- ============================================================
--  v137 hat die Ablage angelegt, aber die beiden CHECK-Bedingungen auf
--  "bereich" kennen nur die drei alten Bereiche. Hochladen haette also
--  funktioniert und "Bilder veroeffentlichen" waere mit einem
--  Datenbankfehler gescheitert - der unangenehmste Fehlertyp, weil er
--  erst ganz am Ende auftritt, wenn die Arbeit schon getan ist.
--
--  Die Aufzaehlung bleibt bewusst eine Aufzaehlung und wird nicht durch
--  "beliebiger Text" ersetzt: sie ist die Stelle, an der ein Tippfehler
--  im Bereichsnamen auffliegt, statt still eine zweite, nie gelesene
--  Zeile anzulegen. Preis dafuer ist genau diese Migration je neuem
--  Bereich - das ist der Preis wert.
-- ============================================================

alter table public.website_inhalte_konfiguration
  drop constraint if exists website_inhalte_bereich_check;
alter table public.website_inhalte_konfiguration
  add constraint website_inhalte_bereich_check
  check (bereich in ('regeln', 'vorlagen', 'unterlagen', 'bilder'));

alter table public.website_inhalte_versionen
  drop constraint if exists website_inhalte_versionen_bereich_check;
alter table public.website_inhalte_versionen
  add constraint website_inhalte_versionen_bereich_check
  check (bereich in ('regeln', 'vorlagen', 'unterlagen', 'bilder'));
