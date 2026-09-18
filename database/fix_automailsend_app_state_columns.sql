-- Migration: Add missing columns to automailsend_app_state table

alter table public.automailsend_app_state 
  add column if not exists automail_enabled boolean default false,
  add column if not exists batch_send_pending boolean default false,
  add column if not exists batch_send_processing boolean default false,
  add column if not exists send_delay_sec integer default 60,
  add column if not exists daily_mail_limit integer default 50,
  add column if not exists smtp_email text default '',
  add column if not exists smtp_password text default '',
  add column if not exists is_blocked boolean default false,
  add column if not exists ai_provider text default 'none',
  add column if not exists ai_api_key text default '',
  add column if not exists ai_prompt text default '',
  add column if not exists allowed_products text[] default '{}'::text[],
  add column if not exists auto_fetch_template_role text default 'fullstack',
  add column if not exists cookie_li_at text default '',
  add column if not exists cookie_jsessionid text default '',
  add column if not exists post_age_filter text default 'any',
  add column if not exists auto_comment_keywords text default '';
