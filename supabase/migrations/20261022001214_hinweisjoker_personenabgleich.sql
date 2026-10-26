-- Applied as 20261022001214.
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('public.obmann_joker_verlauf(text,text)'::regprocedure);
 d:=replace(d,'declare verein uuid; person uuid;','declare verein uuid; v_person uuid;');
 d:=replace(d,'into person from','into v_person from');
 d:=replace(d,'v.person=person','v.person=v_person');
 d:=replace(d,'h.person=person','h.person=v_person');
 execute d;
end $migration$;
