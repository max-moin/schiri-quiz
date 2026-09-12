-- ============================================================
--  v139 - Im Eingang faellt Offenes nicht mehr hinten herunter
-- ============================================================
--  Gefunden am 12.09.2026 beim Nachgehen von Max' "da steht eine 1 und
--  ich seh nix".
--
--  Der Zaehler ("obmann_eingang_zaehler") kennt KEINE Obergrenze - er
--  zaehlt alles Offene. Die Liste ("obmann_eingang") holt dagegen
--  hoechstens v_limit Zeilen, und zwar bisher rein chronologisch:
--      order by st.e_zeit desc limit v_limit
--  Sobald der Strom laenger wird als das Limit, faellt damit das
--  AELTESTE hinten herunter - und das Aelteste ist bei einem Eingang
--  genau das, was am laengsten offen liegt. Die Zahl zaehlt es weiter,
--  die Liste zeigt es nicht mehr. Ein Widerspruch, der nicht auffaellt,
--  solange wenig los ist, und der genau dann zuschlaegt, wenn viel los
--  ist.
--
--  Die Loesung ist nicht ein groesseres Limit (das verschiebt den Tag
--  nur), sondern eine andere Reihenfolge VOR dem Abschneiden:
--  Unerledigtes zuerst, danach das Neueste. Abgeschnitten wird dann
--  immer am erledigten Ende - dort, wo es nicht weh tut.
--
--  Die ANZEIGE-Reihenfolge aendert sich dadurch nicht: die App sortiert
--  ohnehin selbst (chronologisch im Modus "Alles", nach Dringlichkeit
--  in den Postfaechern). Diese Reihenfolge entscheidet allein darueber,
--  WAS die Grenze ueberlebt.
--
--  Chirurgisch geaendert (Vorbild v114): die vorhandene Definition wird
--  gelesen, genau eine Stelle ersetzt und wieder eingespielt. Der Rest
--  der Funktion bleibt byteweise, wie er ist - bei einer gewachsenen
--  Funktion mit sechs CTEs ist Abtippen das groessere Risiko.
-- ============================================================

do $$
declare
  v_def text;
  v_alt text := '  order by st.e_zeit desc' || chr(10) || '  limit v_limit;';
  v_neu text := '  order by (st.e_status in (''erledigt'', ''abgelehnt'', ''abgeschlossen'')) asc,'
                || chr(10) || '           st.e_zeit desc' || chr(10) || '  limit v_limit;';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'obmann_eingang';

  if v_def is null then
    raise exception 'obmann_eingang nicht gefunden';
  end if;
  if position(v_alt in v_def) = 0 then
    raise exception 'Die erwartete ORDER-BY-Stelle steht nicht mehr so da - bitte von Hand nachsehen';
  end if;
  if position(v_neu in v_def) > 0 then
    raise notice 'Bereits angewendet, nichts zu tun';
    return;
  end if;

  execute replace(v_def, v_alt, v_neu);
end;
$$;
