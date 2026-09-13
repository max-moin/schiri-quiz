-- ============================================================
--  v140 - Der Bereich "texte" darf gespeichert werden
-- ============================================================
--  Derselbe Handgriff wie in v138, aus demselben Grund: die beiden
--  CHECK-Bedingungen auf "bereich" sind eine Aufzaehlung, damit ein
--  vertippter Bereichsname sofort auffliegt statt still eine zweite,
--  nie gelesene Zeile anzulegen. Der Preis dafuer ist genau diese
--  Migration je neuem Bereich.
--
--  Was "texte" enthaelt: ein flaches Verzeichnis aus Schluessel und
--  Text fuer die Ueberschriften und Einleitungen der oeffentlichen
--  Seiten. Die Schluessel stehen als data-text-Haken im HTML; welche
--  es gibt, bestimmt src/website/redaktionstexte-standard.js, und
--  tests/redaktionstexte.test.js haelt beides zusammen.
--
--  Ohne diese Migration haette das Bearbeiten im Obmann-Bereich
--  funktioniert und erst "Texte veroeffentlichen" waere mit einem
--  Datenbankfehler gescheitert - also genau dann, wenn die Arbeit
--  schon getan ist.
-- ============================================================

alter table public.website_inhalte_konfiguration
  drop constraint if exists website_inhalte_bereich_check;
alter table public.website_inhalte_konfiguration
  add constraint website_inhalte_bereich_check
  check (bereich in ('regeln', 'vorlagen', 'unterlagen', 'bilder', 'texte'));

alter table public.website_inhalte_versionen
  drop constraint if exists website_inhalte_versionen_bereich_check;
alter table public.website_inhalte_versionen
  add constraint website_inhalte_versionen_bereich_check
  check (bereich in ('regeln', 'vorlagen', 'unterlagen', 'bilder', 'texte'));
