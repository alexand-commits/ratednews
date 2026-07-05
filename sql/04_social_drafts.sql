-- Social content desk — stores AI-drafted social posts generated on a schedule.
-- Written by scripts/social.mjs (service role, bypasses RLS). Read only by the
-- owner via the private /social page.
--
-- Run this once in the Supabase SQL editor.

create table if not exists social_drafts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pack       jsonb not null
);

create index if not exists social_drafts_created_at_idx
  on social_drafts (created_at desc);

-- Owner-only: nobody but the site owner can read drafts. The generator inserts
-- with the service-role key, which bypasses RLS, so no insert policy is needed.
alter table social_drafts enable row level security;

drop policy if exists "owner reads social drafts" on social_drafts;
create policy "owner reads social drafts"
  on social_drafts
  for select
  using ( (auth.jwt() ->> 'email') = 'alexandchow@gmail.com' );
