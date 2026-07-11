-- Profile identity + reply notifications.
-- Run once in the Supabase SQL editor.

-- 1. Identity fields
alter table profiles add column if not exists bio text check (char_length(bio) <= 160);
alter table profiles add column if not exists avatar_color text;
alter table profiles add column if not exists avatar_emoji text check (char_length(avatar_emoji) <= 4);

-- 2. Notifications (denormalised display fields so rendering needs no joins)
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,  -- recipient
  actor_id      uuid references auth.users(id) on delete cascade,           -- who did it
  type          text not null default 'reply',
  article_id    uuid,
  article_title text,
  actor_name    text,
  snippet       text,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;

drop policy if exists "own notifications read" on notifications;
create policy "own notifications read" on notifications
  for select using (auth.uid() = user_id);

-- Recipients may mark their own notifications read (and only read)
drop policy if exists "own notifications mark read" on notifications;
create policy "own notifications mark read" on notifications
  for update using (auth.uid() = user_id) with check (read = true);

-- Any signed-in user may create a notification they are the actor of
drop policy if exists "actor creates" on notifications;
create policy "actor creates" on notifications
  for insert with check (auth.uid() = actor_id);
