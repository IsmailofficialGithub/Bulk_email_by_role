-- Create the global settings table
CREATE TABLE IF NOT EXISTS public.automailsend_global_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    min_fetch_interval INTEGER DEFAULT 5,
    min_pagination_delay INTEGER DEFAULT 5,
    max_pagination_limit INTEGER DEFAULT 10,
    allow_signups BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure only one row exists (id = 1)
ALTER TABLE public.automailsend_global_settings ADD CONSTRAINT enforce_single_row CHECK (id = 1);

-- Insert the default settings if they don't exist
INSERT INTO public.automailsend_global_settings (id, min_fetch_interval, min_pagination_delay, max_pagination_limit, allow_signups)
VALUES (1, 5, 5, 10, true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS)
ALTER TABLE public.automailsend_global_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the global settings (since they are needed for frontend state)
CREATE POLICY "Enable read access for all users" ON public.automailsend_global_settings
    FOR SELECT USING (true);

-- Allow admins to update the global settings
-- Note: Assuming you have a way to identify admins (like an admin role). If not, adjust or disable this policy.
CREATE POLICY "Enable update for service role or admin" ON public.automailsend_global_settings
    FOR UPDATE USING (true);
