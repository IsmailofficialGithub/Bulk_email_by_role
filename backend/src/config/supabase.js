const { createClient } = require("@supabase/supabase-js");
const pc = require("picocolors");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Priority to Service Role Key to bypass RLS, fallback to Anon
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(pc.red("Missing Supabase credentials in .env"));
  process.exit(1);
}

// Warn if using ANON key in backend
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(pc.yellow("⚠️ WARNING: Using ANON key. If RLS is enabled, the backend will not find users. Add SUPABASE_SERVICE_ROLE_KEY to .env!"));
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
