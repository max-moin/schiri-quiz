-- Synthetic accounts and votes only; the transaction is always rolled back.
begin;
do $$
declare
  v uuid:=gen_random_uuid(); w uuid:=gen_random_uuid();
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  i uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); k uuid:=gen_random_uuid();
  rnd uuid; basis jsonb; admin jsonb; d jsonb;
  pass text:=gen_random_uuid()::text;
begin
  if has_function_privilege('anon','public.szenencheck_gateway(jsonb)','execute')
    or has_function_privilege('authenticated','public.szenencheck_gateway(jsonb)','execute')
    or not has_function_privilege('service_role','public.szenencheck_gateway(jsonb)','execute') then
    raise exception 'Gateway grants';
  end if;
  if not exists(select 1 from storage.buckets where id='szenencheck-clips' and not public and file_size_limit=50000000)
    then raise exception 'Bucket not private or limit wrong'; end if;
  insert into public.vereine(id,name) values(v,'Szenencheck Test A'),(w,'Szenencheck Test B');
  insert into public.schiedsrichter(id,name,pin,verein_id,ist_test)
    values(a,'Test A','7296',v,true),(b,'Test B','7296',v,true),(c,'Test C','7296',w,true);
  insert into public.obmann_zugang(id,passwort,verein_id) values(-2147000044,pass,v);
  insert into private.szenencheck_code values(v,extensions.crypt('7193',extensions.gen_salt('bf',4)));
  basis:=jsonb_build_object('person',a,'pin','7296','code','7193','aktion','laden');
  if public.szenencheck_gateway(basis)->>'phase' is distinct from 'leer' then raise exception 'Empty'; end if;
  if public.szenencheck_gateway(basis||'{"code":"1111"}')->>'fehler' is distinct from 'zugang' then raise exception 'Wrong code'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('person',c))->>'fehler' is distinct from 'zugang' then raise exception 'Other club'; end if;
  for n in 1..4 loop
    perform public.szenencheck_gateway(basis||'{"pin":"1111"}');
  end loop;
  if public.szenencheck_gateway(basis)->>'fehler' is distinct from 'warte' then raise exception 'Rate limit'; end if;
  update private.szenencheck_versuche set seit=now()-interval '16 minutes' where person=a;
  if public.szenencheck_gateway(basis)->>'phase' is distinct from 'leer' then raise exception 'Rate limit expiry'; end if;

  admin:=jsonb_build_object('aktion','planen','passwort',pass,'titel','Testrunde','beginn',now()+interval '5 minutes','schluss',now()+interval '1 hour',
    'szenen',jsonb_build_array(
      jsonb_build_object('id',i,'art','detail','titel','Icon','youtube','dQw4w9WgXcQ','start',10,'ende',20,'feld','VERBORGEN'),
      jsonb_build_object('id',j,'art','multipleChoice','titel','MC','optionen','["A","B"]'::jsonb),
      jsonb_build_object('id',k,'art','freitext','titel','Text')));
  if public.szenencheck_gateway(admin||'{"passwort":"falsch"}')->>'fehler' is distinct from 'zugang' then raise exception 'Admin gate'; end if;
  rnd:=(public.szenencheck_gateway(admin)->>'id')::uuid;
  if rnd is null then raise exception 'Plan'; end if;
  d:=public.szenencheck_gateway(basis);
  if d->>'phase' is distinct from 'geplant' or d ? 'szenen' then raise exception 'Future round leaks'; end if;
  if public.szenencheck_gateway(admin)->>'fehler' is distinct from 'ueberschneidung' then raise exception 'Overlapping plan'; end if;
  update private.szenencheck_runden set beginn=now()-interval '1 minute' where id=rnd;
  d:=public.szenencheck_gateway(basis);
  if d->>'phase' is distinct from 'offen' or d::text like '%VERBORGEN%' or d->'recap' <> '{}'::jsonb then raise exception 'Pre-close leak'; end if;
  basis:=basis||jsonb_build_object('aktion','stimme','runde',rnd);
  if public.szenencheck_gateway(basis||jsonb_build_object('szene',i,'antwort','{"pfiff":"foul"}'::jsonb))->>'fehler' is distinct from 'antwort' then raise exception 'Partial icon accepted'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('szene',i,'antwort','{"pfiff":"foul","karte":"gelb"}'::jsonb))->>'ok' is distinct from 'true' then raise exception 'Icon rejected'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('szene',j,'antwort','{"wahl":"C"}'::jsonb))->>'fehler' is distinct from 'antwort' then raise exception 'Invalid MC accepted'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('szene',j,'antwort','{"wahl":"A"}'::jsonb))->>'ok' is distinct from 'true' then raise exception 'MC rejected'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('szene',j,'antwort','{"wahl":"B"}'::jsonb))->>'ok' is distinct from 'true' then raise exception 'MC edit rejected'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('szene',k,'antwort','{"text":"TESTPRIVATE"}'::jsonb))->>'ok' is distinct from 'true' then raise exception 'Text rejected'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('person',b,'szene',i,'antwort','{"enthaltung":true}'::jsonb))->>'ok' is distinct from 'true' then raise exception 'Abstention rejected'; end if;
  d:=public.szenencheck_gateway(basis||jsonb_build_object('person',b,'aktion','laden')-'runde');
  if d::text like '%TESTPRIVATE%' or d->'stimmen' ? j::text or d->'recap'<>'{}'::jsonb then raise exception 'Other member vote visible'; end if;
  update private.szenencheck_runden set schluss=now()-interval '1 second' where id=rnd;
  d:=public.szenencheck_gateway(basis||jsonb_build_object('person',b,'aktion','laden'));
  if d->>'phase' is distinct from 'recap' or d::text not like '%VERBORGEN%' or d::text like '%TESTPRIVATE%'
    or jsonb_array_length(d->'recap'->i::text)<>2 or d->'recap'->j::text->0->'antwort'->>'wahl' is distinct from 'B'
    then raise exception 'Recap'; end if;
  if public.szenencheck_gateway(basis||jsonb_build_object('szene',j,'antwort','{"wahl":"A"}'::jsonb))->>'fehler' is distinct from 'geschlossen' then raise exception 'Late vote accepted'; end if;
  if public.szenencheck_gateway(jsonb_build_object('aktion','zurueckziehen','passwort',pass,'runde',rnd))->>'ok' is distinct from 'true' then raise exception 'Withdraw'; end if;
  if public.szenencheck_gateway(basis||'{"aktion":"laden"}')->>'fehler' is distinct from 'runde' then raise exception 'Withdrawn round visible'; end if;
end;
$$;
rollback;
