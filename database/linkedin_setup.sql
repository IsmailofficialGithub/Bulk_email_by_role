-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.linkedin_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    linkedin_person_urn TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own linkedin account
CREATE POLICY "Users can read own linkedin account"
    ON public.linkedin_accounts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only admins/backend service role can insert/update/delete (handled via API)
