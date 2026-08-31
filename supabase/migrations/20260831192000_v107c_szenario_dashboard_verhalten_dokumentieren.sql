-- v107c, 31.08.2026 -- reine Klarstellung, keine Verhaltensaenderung.
--
-- Beim Nachtesten von v107b hat sich gezeigt, dass mein Kommentar dort das
-- Verhalten falsch beschrieben hat: "obmann_verein" gibt bei einem falschen
-- Passwort nicht null zurueck, sondern wirft einen Fehler (RAISE 'Falsches
-- Passwort'). Der Zweig "if v_verein is null then return; end if;" im Rumpf
-- ist damit praktisch unerreichbar - er ist Absicherung, nicht der normale
-- Weg. Wer den Kommentar von v107b liest, wuerde dagegen eine leere
-- Ergebnismenge erwarten und beim Fehlersuchen an der falschen Stelle
-- graben. Die Wahrheit steht deshalb ab jetzt an der Funktion selbst.

comment on function public.obmann_szenario_dashboard(text) is
'Kennzahlen des Szenario-Modus (eine Zeile). p_passwort ist optional. Wird es mitgeschickt, prueft obmann_verein() es und wirft bei falschem Passwort einen Fehler - es kommt also KEINE leere Ergebnismenge zurueck. Ohne p_passwort liefert die Funktion die vereinsuebergreifenden Kennzahlen; sie enthalten keine Namen. Der null-Zweig im Rumpf ist unerreichbare Absicherung. Siehe v107b/v107c.';
