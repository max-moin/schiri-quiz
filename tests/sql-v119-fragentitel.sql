-- Nur Testdaten innerhalb dieser Transaktion; kein echter Inhalt wird geändert.
begin;
do $$
declare
  v_pin text;
  v_id uuid;
  v_basis jsonb := '{"frage_text":"TEST Wie ist zu entscheiden?","medium":"video","antworttyp":"multiple_choice","video_url":"https://www.youtube.com/watch?v=abcdefghijk","antwort_hinweis":"TEST Szene am Torwart"}';
  v_inhalt jsonb := '{"optionen":[{"text":"A","richtig":true},{"text":"B","richtig":false}]}';
  v_abgewiesen boolean;
begin
  select passwort into strict v_pin from public.obmann_zugang limit 1;
  v_id := public.obmann_frage_mit_titel_speichern(v_pin, null, v_basis, v_inhalt, false, '{}', '  TEST Wolfsburg – Torwart  ');
  assert exists(select 1 from public.obmann_fragen_kennzeichnungen(v_pin)
    where frage_id = v_id and kurztitel = 'TEST Wolfsburg – Torwart' and medium = 'video' and kontext = 'TEST Szene am Torwart'), 'Titel/Medienkontext fehlt';
  assert (select frage_text from public.fragen where id=v_id) = 'TEST Wie ist zu entscheiden?', 'Öffentlicher Fragetext überschrieben';
  assert not has_table_privilege('anon','public.frage_redaktion','SELECT'), 'Titel öffentlich';
  assert not has_table_privilege('authenticated','public.frage_redaktion','SELECT'), 'Titel für Teilnehmer lesbar';
  assert not has_table_privilege('anon','public.frage_redaktion','INSERT'), 'Titel öffentlich schreibbar';
  assert not has_table_privilege('authenticated','public.frage_redaktion','UPDATE'), 'Titel ohne Obmann änderbar';

  v_abgewiesen := false;
  begin
    perform public.obmann_fragen_kennzeichnungen(null);
  exception when others then v_abgewiesen := true;
  end;
  assert v_abgewiesen, 'Lesen ohne Passwort möglich';
  v_abgewiesen := false;
  begin
    perform public.obmann_frage_mit_titel_speichern(null, v_id, v_basis, v_inhalt, false, '{}', 'Angriff');
  exception when others then v_abgewiesen := true;
  end;
  assert v_abgewiesen, 'Schreiben ohne Passwort möglich';

  -- Ältere App-Versionen dürfen einen bestehenden Titel nicht entfernen.
  perform public.obmann_frage_flex_speichern(v_pin, v_id, v_basis, v_inhalt);
  assert exists(select 1 from public.frage_redaktion where frage_id=v_id and kurztitel='TEST Wolfsburg – Torwart'), 'Legacy-Speichern entfernt Titel';

  v_abgewiesen := false;
  begin
    perform public.obmann_frage_mit_titel_speichern(v_pin, v_id,
      jsonb_set(v_basis, '{frage_text}', '"Darf nicht gespeichert werden"'), v_inhalt, false, '{}', repeat('x',121));
  exception when others then v_abgewiesen := true;
  end;
  assert v_abgewiesen, 'Titelgrenze fehlt';
  assert (select frage_text from public.fragen where id=v_id)='TEST Wie ist zu entscheiden?', 'Teilweise gespeichert';
  perform public.obmann_frage_mit_titel_speichern(v_pin, v_id, v_basis, v_inhalt, false, '{}', 'Neuer Titel');
  assert exists(select 1 from public.frage_redaktion where frage_id=v_id and kurztitel='Neuer Titel'), 'Titeländerung fehlt';
  perform public.obmann_frage_mit_titel_speichern(v_pin, v_id, v_basis, v_inhalt, false, '{}', ' ');
  assert not exists(select 1 from public.frage_redaktion where frage_id=v_id), 'Titel nicht geleert';
  assert exists(select 1 from public.fragen where id=v_id), 'Frage beim Leeren gelöscht';

  -- Auch der separate Icon-Speicherweg muss Titel und Lösung gemeinsam ablegen.
  v_id := public.obmann_frage_mit_titel_speichern(v_pin, null, v_basis, '{}', true,
    '{"spielfortsetzung":"weiterspielen","fordert_fortsetzung_ort":false,"strafen":[]}', 'TEST Icon-Szene');
  assert exists(select 1 from public.frage_entscheidungsloesungen where frage_id=v_id and spielfortsetzung='weiterspielen'), 'Icon-Lösung fehlt';
  assert exists(select 1 from public.frage_redaktion where frage_id=v_id and kurztitel='TEST Icon-Szene'), 'Icon-Titel fehlt';

  -- Bildmetadaten werden als Text geliefert, nicht als Bilddownload.
  v_id := public.obmann_frage_mit_titel_speichern(v_pin, null,
    '{"frage_text":"TEST Bildfrage","medium":"bild","antworttyp":"freitext","musterantwort":"TEST"}',
    '{"bild_base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=","bild_mime":"image/png","bild_alt":"TEST Kontakt am Torwart"}', false, '{}', '');
  assert exists(select 1 from public.obmann_fragen_kennzeichnungen(v_pin)
    where frage_id=v_id and kurztitel is null and kontext='TEST Kontakt am Torwart'), 'Bildkontext fehlt';
end;
$$;
rollback;
