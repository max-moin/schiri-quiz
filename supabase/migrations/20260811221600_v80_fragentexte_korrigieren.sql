-- Ausschliesslich offensichtliche Rechtschreib- und Abstandsfehler korrigieren.
-- Die alten Texte stehen zusaetzlich in der WHERE-Bedingung, damit die
-- Migration bei spaeter bereits geaenderten Inhalten nichts ueberschreibt.

begin;

update public.fragen
set frage_text = 'Welche Farbe dürfen die Kopfbedeckungen der Feldspieler haben?'
where id = 'b00dcf81-fb32-4114-88fc-2d76f69c2b4d'
  and frage_text = 'Welchen Farbe dürfen die Kopfbedeckungen der Feldspieler haben?';

update public.fragen
set option_b = 'JA, da die zehn Sekunden überschritten waren'
where id = '1b2a3247-60a5-466c-ac8f-99b93caa5407'
  and option_b = 'JA, da die 10sek überschritten waren';

update public.fragen
set
  option_a = 'Es darf dreimal gewechselt werden',
  option_c = 'Maximal sechsmal darf jedes Team wechseln'
where id = '70fb2e6a-2f38-4c62-9d50-65b041354847'
  and option_a = 'Es darf drei mal gewechselt werden'
  and option_c = 'Maximal sechs mal darf jedes Team wechseln';

commit;
