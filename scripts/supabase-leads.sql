-- ============================================================================
-- FIX: site lead capture is broken — site_leads has 0 rows because the site JS
-- resolves project_id from a `projects` table that does not exist in the client
-- Supabase (fnlgclkcbkmoailfdukt), so project_id is null and the insert is
-- rejected. This migration (1) creates the projects registry with the allclean
-- row so project_id resolves, and (2) locks down site_leads RLS so the public
-- anon key may INSERT a lead but can NEVER read leads back (it currently can —
-- a personal-data / GDPR hole). Run in the Supabase SQL editor of project
-- fnlgclkcbkmoailfdukt. Safe to re-run.
-- ============================================================================

-- 1) projects registry — the site's lead script does
--    GET /rest/v1/projects?slug=eq.allclean&select=id  to stamp project_id.
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text,
  created_at timestamptz not null default now()
);

-- Same id already used for this client's articles table (keeps project_id
-- consistent across the platform). on conflict = safe re-run.
insert into public.projects (id, slug, name)
values ('8878db57-c541-4502-bfa6-ae812dc3aefd', 'allclean', 'AllClean')
on conflict (slug) do nothing;

-- projects must be READABLE by anon (the form does a select on it), but never
-- writable by anon. RLS on, select-only policy.
alter table public.projects enable row level security;
drop policy if exists projects_anon_read on public.projects;
create policy projects_anon_read on public.projects
  for select to anon using (true);

-- 2) site_leads — public form INSERTs, nothing else. Reads go through the
--    server (service_role) only, never the browser anon key.
alter table public.site_leads enable row level security;

drop policy if exists site_leads_anon_insert on public.site_leads;
create policy site_leads_anon_insert on public.site_leads
  for insert to anon with check (true);

-- Ensure anon can NOT read/update/delete leads (personal data). service_role
-- bypasses RLS, so the cabinet's /api/leads reader is unaffected.
revoke select, update, delete on public.site_leads from anon;

-- If project_id is NOT NULL and you want to hard-guarantee integrity, you may
-- additionally add a FK (optional; uncomment if desired):
-- alter table public.site_leads
--   add constraint site_leads_project_fk
--   foreign key (project_id) references public.projects(id);
