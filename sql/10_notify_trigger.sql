-- Reply notifications, created server-side.
--
-- Problem: the client inserted notification rows directly, and the RLS insert
-- policy only constrained actor_id = auth.uid(). Recipient (user_id),
-- actor_name, snippet, article_title were all attacker-controlled — a signed-in
-- user could push a spoofed "RatedNews Team: verify at evil.com" notification
-- to any/every user.
--
-- Fix: derive everything server-side from the inserted comment via a
-- SECURITY DEFINER trigger, and remove the client's ability to insert.
--
-- Run once in the Supabase SQL editor. (Must run before/with the app deploy
-- that removes the client-side insert — until it runs, replies won't notify.)

create or replace function notify_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_user    uuid;
  actor_username text;
  art_title      text;
begin
  if new.parent_id is null then return new; end if;

  select user_id into parent_user from comments where id = new.parent_id;
  -- No recipient, or replying to yourself → no notification.
  if parent_user is null or parent_user = new.user_id then return new; end if;

  select username into actor_username from profiles where user_id = new.user_id;
  select title    into art_title      from articles where id = new.article_id;

  insert into notifications
    (user_id, actor_id, type, article_id, article_title, actor_name, snippet)
  values
    (parent_user, new.user_id, 'reply', new.article_id,
     left(coalesce(art_title, ''), 120),
     coalesce(actor_username, 'A reader'),
     left(coalesce(new.body, ''), 90));

  return new;
end;
$$;

drop trigger if exists trg_notify_on_reply on comments;
create trigger trg_notify_on_reply
  after insert on comments
  for each row execute function notify_on_reply();

-- Remove the client insert path entirely — the trigger is now the only writer.
drop policy if exists "actor creates" on notifications;
revoke insert on notifications from anon, authenticated;
