-- Published version history — the way back from a publish.
--
-- Publishing is the one irreversible action in the product: it replaces what visitors see, and until
-- now nothing recorded what was there a minute earlier. Every publish now stores the exact state it
-- shipped, so a client who publishes something they regret can put the previous version back instead
-- of trying to reconstruct it by hand.
--
-- Run once in the Supabase SQL editor of the client project.

create table if not exists public.site_versions (
  id          uuid        primary key default gen_random_uuid(),
  project     text        not null,
  created_at  timestamptz not null default now(),
  created_by  text,                                    -- who pressed Publish
  note        text,                                    -- e.g. "12 правок на 3 страницах"
  pages       integer     not null default 0,
  snapshot    jsonb       not null                     -- { overrides: {pageId:{blockId:html}}, breakpoints: {pageId:PageBp} }
);

create index if not exists site_versions_project_idx on public.site_versions (project, created_at desc);

-- Same posture as site_overrides / site_drafts: reachable only through the server endpoints using the
-- service_role key. The browser must never read or write this table directly.
alter table public.site_versions enable row level security;

revoke all on public.site_versions from anon, authenticated;

comment on table public.site_versions is
  'Snapshot of every publish, so a published state can be restored. Written by /api/publish, read and restored by /api/versions.';
