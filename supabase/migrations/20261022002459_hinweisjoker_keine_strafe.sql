-- Applied as 20261022002459.
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('private.hinweis_strafentext(uuid)'::regprocedure);
 d:=replace(d,'coalesce(array_to_string(teile,''; ''),''Keine persönliche Strafe'')','coalesce(nullif(array_to_string(teile,''; ''),''''),''Keine persönliche Strafe'')');
 if position('nullif(array_to_string' in d)=0 then raise exception 'Unexpected card text'; end if;
 execute d;
end $migration$;
