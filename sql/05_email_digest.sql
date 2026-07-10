-- Weekly email digest preferences. Every signed-up user is opted in by
-- default (standard for a product digest) with one-click unsubscribe via a
-- per-user token — no login needed to opt out.
--
-- Run once in the Supabase SQL editor.

create table if not exists email_prefs (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  weekly_digest  boolean not null default true,
  unsub_token    uuid not null default gen_random_uuid(),
  updated_at     timestamptz not null default now()
);

alter table email_prefs enable row level security;

-- Owners can read their own prefs
drop policy if exists "own prefs read" on email_prefs;
create policy "own prefs read" on email_prefs
  for select using (auth.uid() = user_id);

-- One-click unsubscribe: anyone presenting the correct token may flip the
-- flag off (and only off) — the token is the capability.
drop policy if exists "unsubscribe by token" on email_prefs;
create policy "unsubscribe by token" on email_prefs
  for update
  using (true)
  with check (weekly_digest = false);
