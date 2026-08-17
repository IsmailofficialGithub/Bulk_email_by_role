-- Add auto_comment columns to automailsend_app_state
alter table public.automailsend_app_state 
  add column if not exists auto_comment_enabled boolean default false,
  add column if not exists auto_comment_prompt text default 'You are an insightful professional on LinkedIn. Write a short, encouraging comment for this post: {{post_text}}',
  add column if not exists auto_comment_limit integer default 10,
  add column if not exists auto_comment_interval_min integer default 60;
