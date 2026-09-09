-- v131: Deckt den Fremdschluessel auf den zuletzt aendernden Redakteur ab.

create index if not exists website_funktionsfreigaben_updated_by_idx
  on public.website_funktionsfreigaben (updated_by);
