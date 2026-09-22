-- v160: Regelmaessiger, autorisierter Aufruf der Benachrichtigungs-Function.
--
-- Die oeffentliche Projekt-URL und der oeffentliche Publishable Key werden
-- bewusst nicht ins Repository geschrieben. Der Cron-Job liest beide aus
-- Supabase Vault. Fehlen sie in einer frischen Umgebung, macht der Job nichts,
-- statt alle zwei Minuten einen Fehler zu erzeugen.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $block$
declare
  v_job record;
begin
  for v_job in
    select j.jobid from cron.job j
     where j.jobname = 'obmann-benachrichtigungen'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$block$;

select cron.schedule(
  'obmann-benachrichtigungen',
  '*/2 * * * *',
  $cron$
    with konfiguration as (
      select
        max(s.decrypted_secret) filter (where s.name = 'obmann_project_url') as project_url,
        max(s.decrypted_secret) filter (where s.name = 'obmann_publishable_key') as publishable_key
      from vault.decrypted_secrets s
      having count(*) filter (
        where s.name in ('obmann_project_url', 'obmann_publishable_key')
      ) = 2
    )
    select net.http_post(
      url := k.project_url || '/functions/v1/obmann-benachrichtigungen',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || k.publishable_key,
        'apikey', k.publishable_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    )
    from konfiguration k
  $cron$
);

