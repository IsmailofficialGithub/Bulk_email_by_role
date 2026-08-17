-- SQL setup script for LinkedIn Comments Log

create table if not exists public.automailsend_linkedin_comments_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  post_url text not null,
  comment_text text not null,
  status text default 'sent',
  error_message text,
  sent_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.automailsend_linkedin_comments_log enable row level security;

-- Create policies (Users can only see and insert their own logs)
create policy "Users can view own comments_log" 
  on public.automailsend_linkedin_comments_log 
  for select 
  to authenticated 
  using (auth.uid() = user_id);

create policy "Users can insert own comments_log" 
  on public.automailsend_linkedin_comments_log 
  for insert 
  to authenticated 
  with check (auth.uid() = user_id);

create policy "Users can delete own comments_log" 
  on public.automailsend_linkedin_comments_log 
  for delete 
  to authenticated 
  using (auth.uid() = user_id);
