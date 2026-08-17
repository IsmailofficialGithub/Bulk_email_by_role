require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { error } = await supabase.rpc('add_column_if_not_exists', {
    table_name: 'automailsend_app_state',
    column_name: 'auto_comment_keywords',
    data_type: 'text'
  });
  
  if (error) {
     console.log("RPC failed, trying raw query? Can't do raw query from client... let's just insert/update with standard JS by recreating table? No.");
     console.error(error);
  }
}
check();
