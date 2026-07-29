-- Supabase Setup Script for AutoMailSend

-- 1. Create the attachments bucket
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 2. Setup RLS for attachments bucket
-- Allow authenticated users to upload to attachments
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'attachments' );

-- Allow public to read from attachments (since we need to send the URL to nodemailer, and it might fetch it anonymously if it's a public URL)
create policy "Allow public read"
on storage.objects for select
to public
using ( bucket_id = 'attachments' );

-- Allow authenticated users to delete their own objects (optional)
create policy "Allow user to delete their own files"
on storage.objects for delete
to authenticated
using ( bucket_id = 'attachments' and (auth.uid() = owner) );

-- 3. Create automailsend_app_state table
create table if not exists public.automailsend_app_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  config jsonb default '{"email": "", "appPassword": "", "configured": false}'::jsonb,
  delay_sec integer default 3,
  active_template_role text default 'fullstack',
  default_title text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Create automailsend_recipients table
create table if not exists public.automailsend_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  email text not null,
  role text not null,
  title text default '',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Create automailsend_templates table
create table if not exists public.automailsend_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  role text not null,
  subject text default '',
  content text default '',
  files jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, role)
);

-- 6. Create automailsend_sent_log table
create table if not exists public.automailsend_sent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  email text not null,
  role text not null,
  title text default '',
  status text default 'sent',
  error_message text,
  sent_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Enable RLS on all tables
alter table public.automailsend_app_state enable row level security;
alter table public.automailsend_recipients enable row level security;
alter table public.automailsend_templates enable row level security;
alter table public.automailsend_sent_log enable row level security;

-- 8. Create policies for tables (Users can only see and edit their own data)
create policy "Users can view own app_state" on public.automailsend_app_state for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own app_state" on public.automailsend_app_state for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own app_state" on public.automailsend_app_state for update to authenticated using (auth.uid() = user_id);

create policy "Users can view own recipients" on public.automailsend_recipients for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own recipients" on public.automailsend_recipients for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own recipients" on public.automailsend_recipients for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete own recipients" on public.automailsend_recipients for delete to authenticated using (auth.uid() = user_id);

create policy "Users can view own templates" on public.automailsend_templates for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own templates" on public.automailsend_templates for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own templates" on public.automailsend_templates for update to authenticated using (auth.uid() = user_id);

create policy "Users can view own sent_log" on public.automailsend_sent_log for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own sent_log" on public.automailsend_sent_log for insert to authenticated with check (auth.uid() = user_id);

-- 9. Trigger for updating updated_at on automailsend_app_state and automailsend_templates
create or replace function update_modified_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_automailsend_app_state_modtime
before update on public.automailsend_app_state
for each row execute function update_modified_column();

create trigger update_automailsend_templates_modtime
before update on public.automailsend_templates
for each row execute function update_modified_column();
-- 10. (Added later) Auto-Fetch Configuration for LinkedIn
alter table public.automailsend_app_state 
  add column if not exists auto_fetch_enabled boolean default false,
  add column if not exists auto_fetch_keywords text default '',
  add column if not exists auto_fetch_interval_min integer default 5,
  add column if not exists auto_fetch_li_at text default '',
  add column if not exists auto_fetch_jsessionid text default '';
