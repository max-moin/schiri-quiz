-- v135: Listen und Sammelbestellungen filtern Anfragen regelmaessig nach
-- Person. Der Index deckt zugleich den bereits vorhandenen Fremdschluessel.
create index if not exists ausruestungs_anfragen_schiedsrichter_idx
  on public.ausruestungs_anfragen(schiedsrichter_id);
