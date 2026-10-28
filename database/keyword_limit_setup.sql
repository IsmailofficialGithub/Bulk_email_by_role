-- Per-user cap on auto-fetch keywords, set by admins in the Admin Portal.
alter table public.automailsend_app_state
  add column if not exists keyword_limit integer not null default 3;
