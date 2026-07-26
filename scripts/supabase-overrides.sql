-- Platform site overrides — run once in the client Supabase (SQL editor).
-- One row per (project, page_id) holds the editor's edits; the Vercel build reads them so publishing
-- is instant (save → rebuild). Mirrors the old Astro `page_overrides` idea, in the platform's format.

create table if not exists public.site_overrides (
  project     text not null,
  page_id     text not null,
  overrides   jsonb not null default '{}'::jsonb,   -- { blockId: html }  (per-block edited HTML)
  breakpoints jsonb not null default '{}'::jsonb,   -- PageBp { tablet, mobile, hover, active }
  updated_at  timestamptz not null default now(),
  primary key (project, page_id)
);

alter table public.site_overrides enable row level security;

-- anon may READ (build/preview needs it, no secrets in the data). WRITES go through the server /
-- publish proxy using the service_role key — never from the browser.
drop policy if exists site_overrides_read on public.site_overrides;
create policy site_overrides_read on public.site_overrides for select to anon using (true);
