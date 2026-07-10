-- Public digest signups (no account required) — the sidebar email capture.
-- Run once in the Supabase SQL editor.

create table if not exists digest_subscribers (
  email       text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  unsub_token uuid not null default gen_random_uuid(),
  subscribed  boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table digest_subscribers enable row level security;

-- Anyone may sign up (insert only — no reads, so the list can't be scraped)
drop policy if exists "public signup" on digest_subscribers;
create policy "public signup" on digest_subscribers
  for insert with check (true);

-- One-click unsubscribe by token, off-only
drop policy if exists "unsubscribe by token" on digest_subscribers;
create policy "unsubscribe by token" on digest_subscribers
  for update using (true) with check (subscribed = false);
