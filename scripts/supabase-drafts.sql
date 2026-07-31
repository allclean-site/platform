-- Shared DRAFT layer for the site editor (live editing).
--
-- Problem it solves: edits used to live only in the authoring browser's localStorage until someone hit
-- «Опубликовать». So the agency never saw what the client was working on, and the two sides drifted.
--
-- `site_drafts` holds the CURRENT unpublished state per page. The editor reads it on open (and on
-- window focus) and writes it back as you type (debounced), so every cabinet shows the same draft.
-- Publishing copies the draft into `site_overrides` (the published layer that the build reads).
--
-- Run once in the Supabase SQL editor of the client project.

create table if not exists public.site_drafts (
  project     text        not null,
  page_id     text        not null,
  overrides   jsonb       not null default '{}'::jsonb,   -- { blockId: html }
  breakpoints jsonb       not null default '{}'::jsonb,   -- PageBp (base/tablet/mobile/hover/active)
  updated_at  timestamptz not null default now(),
  updated_by  text,                                       -- display name, for "кто правил последним"
  primary key (project, page_id)
);

create index if not exists site_drafts_project_idx on public.site_drafts (project);

-- Drafts are reachable ONLY through the server endpoint (/api/draft) using the service_role key,
-- exactly like site_overrides: RLS on with no anon/authenticated policies = the browser cannot read or
-- write this table directly with the public anon key.
alter table public.site_drafts enable row level security;

revoke all on public.site_drafts from anon, authenticated;

comment on table public.site_drafts is
  'Unpublished editor state per page (shared live draft). Written by /api/draft with service_role; published into site_overrides.';
