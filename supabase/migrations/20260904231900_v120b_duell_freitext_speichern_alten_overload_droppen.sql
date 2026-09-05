-- v120b: v120 hat "duell_freitext_speichern" per CREATE OR REPLACE um zwei
-- Parameter (p_status,p_nachfrage) erweitert. Postgres identifiziert eine
-- Funktion aber ueber Name+Parametertypliste - eine andere Parameteranzahl
-- ist ein ANDERER Overload, nicht dieselbe Funktion neu definiert (die
-- schon aus v85 bekannte PGRST202-Falle: "drop+create (never create or
-- replace), wenn sich die Signatur aendert"). Ergebnis: der alte
-- 5-Parameter-Overload existierte parallel weiter. Da der einzige
-- Aufrufer (api/duell-freitext.js) beim Umbau auf den 7-Parameter-
-- Overload umgestellt wurde, wird der alte hier sauber entfernt.
drop function if exists public.duell_freitext_speichern(uuid,uuid,text,boolean,text);
