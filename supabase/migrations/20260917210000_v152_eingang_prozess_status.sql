-- =====================================================================
-- v152 - Eingang: Prozesseintraege abhaken
-- =====================================================================
--
-- Nachtrag zu v151. Die App hakt einen Eingangseintrag ueber
-- obmann_meldung_status_setzen ab. Die neue Art 'prozess' fehlte dort
-- noch - ohne diesen Zweig liefe jeder Haken an einem Prozesseintrag in
-- die Ausnahme "Art prozess kann nicht erledigt werden".
--
-- Zwei Punkte:
--
-- 1. Ein Prozessereignis hat keinen eigenen fachlichen Status. Es ist
--    ein Nachweis. Gesetzt wird hier ausschliesslich, ob Max es gelesen
--    beziehungsweise abgehakt hat. 'offen' nimmt den Haken wieder weg.
--
-- 2. Die Art 'anfrage' meint seit v151 nur noch Anliegen. Ein
--    Ausruestungsvorgang darf hier nicht mehr per Status umgebogen
--    werden - dafuer gibt es die Prozessaktionen. Statt still das
--    Falsche zu tun, sagt die Funktion das jetzt deutlich.
-- =====================================================================

create or replace function public.obmann_meldung_status_setzen(
  p_passwort text, p_art text, p_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_treffer integer := 0;
begin
  v_verein := obmann_verein(p_passwort);

  if p_id is null then
    raise exception 'Keine id uebergeben';
  end if;

  if p_art = 'anfrage' then
    if p_status not in ('offen','angenommen','abgelehnt','erledigt') then
      raise exception 'Status % ist fuer eine Anfrage nicht zulaessig', p_status;
    end if;
    -- Nur Anliegen. Ausruestung laeuft ueber den Beschaffungsprozess.
    update ausruestungs_anfragen a
       set status = p_status
     where a.id = p_id
       and a.typ = 'anliegen'
       and exists (select 1 from schiedsrichter s
                    where s.id = a.schiedsrichter_id and s.verein_id = v_verein);
    get diagnostics v_treffer = row_count;
    if v_treffer = 0
       and exists (select 1 from ausruestungs_anfragen a
                    join schiedsrichter s on s.id = a.schiedsrichter_id
                   where a.id = p_id and s.verein_id = v_verein
                     and a.typ = 'ausruestung') then
      raise exception 'Ausruestungsvorgaenge werden ueber den Beschaffungsprozess bearbeitet, nicht ueber den Status';
    end if;

  elsif p_art = 'prozess' then
    -- Ein Ereignis wird nicht geloescht und nicht umgedeutet. Es wird
    -- gelesen oder abgehakt.
    if p_status not in ('offen','gelesen','erledigt') then
      raise exception 'Status % ist fuer einen Prozesseintrag nicht zulaessig', p_status;
    end if;
    update ausruestung_ereignisse e
       set eingang_gelesen_am = case when p_status = 'offen'
                                     then null
                                     else coalesce(e.eingang_gelesen_am, now()) end,
           eingang_erledigt_am = case when p_status = 'erledigt' then now() else null end
     where e.id = p_id and e.verein_id = v_verein;
    get diagnostics v_treffer = row_count;

  elsif p_art = 'absage' then
    if p_status not in ('offen','erledigt') then
      raise exception 'Status % ist fuer eine Absage nicht zulaessig', p_status;
    end if;
    update termin_rueckmeldungen tr
       set obmann_erledigt = (p_status = 'erledigt')
     where tr.id = p_id
       and exists (select 1 from termine t
                    where t.id = tr.termin_id and t.verein_id = v_verein);
    get diagnostics v_treffer = row_count;

  elsif p_art = 'frage_meldung' then
    if p_status not in ('offen','gelesen','in_arbeit','erledigt','abgelehnt') then
      raise exception 'Status % ist fuer eine Frage-Rueckmeldung nicht zulaessig', p_status;
    end if;
    begin
      update frage_meldungen fm
         set status = p_status, aktualisiert_am = now()
       where fm.id = p_id and fm.verein_id = v_verein;
      get diagnostics v_treffer = row_count;
    exception when unique_violation then
      raise exception 'Zu dieser Frage liegt von dieser Person bereits eine unerledigte Rueckmeldung vor; dieser Vorgang kann nicht wieder geoeffnet werden';
    end;
    if v_treffer > 0 and p_status = 'erledigt' then
      update frage_meldung_eintraege e
         set erledigt = true,
             erledigt_am = coalesce(e.erledigt_am, now())
       where e.meldung_id = p_id and e.erledigt = false;
    end if;

  elsif p_art = 'meldung' then
    if p_status not in ('offen','gelesen','in_arbeit','erledigt') then
      raise exception 'Status % ist fuer einen Meldebogen nicht zulaessig', p_status;
    end if;
    update meldungen m
       set status = p_status
     where m.id = p_id and m.verein_id = v_verein;
    get diagnostics v_treffer = row_count;

  elsif p_art = 'fragenvorschlag' then
    if p_status not in ('offen','in_arbeit') then
      raise exception 'Ein Fragenvorschlag wird im Vorschlaege-Menue entschieden, nicht im Eingang';
    end if;
    update fragenvorschlaege fv
       set status = case when p_status = 'in_arbeit' then 'in_pruefung' else 'eingereicht' end,
           aktualisiert_am = now()
     where fv.id = p_id
       and fv.verein_id = v_verein
       and fv.status in ('eingereicht','in_pruefung');
    get diagnostics v_treffer = row_count;

  else
    raise exception 'Art % kann nicht erledigt werden', coalesce(p_art, '(null)');
  end if;

  if v_treffer = 0 then
    raise exception 'Kein passender Eintrag in diesem Verein gefunden';
  end if;

  return p_status;
end;
$function$;
