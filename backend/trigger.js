require("dotenv").config();
const pc = require("picocolors");
const { supabase } = require("./src/config/supabase");
const { processJob } = require("./src/workers/scraper.worker");

async function triggerManualScrape() {
  console.log(pc.bgGreen(pc.white(" Starting Manual Trigger Script... ")));

  const { data: users, error } = await supabase
    .from("automailsend_app_state")
    .select("*")
    .eq("auto_fetch_enabled", true);

  if (error) {
    console.error(pc.bgRed(pc.white(` Error fetching users: ${error.message} `)));
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log(pc.bgYellow(pc.black(" No enabled users found. ")));
    process.exit(0);
  }

  console.log(pc.bgBlue(pc.white(` Found ${users.length} enabled users. Processing immediately... `)));

  for (const user of users) {
    try {
      console.log(pc.bgCyan(pc.black(`\n--- Processing User: ${user.user_id} --- `)));
      // Fake the bullmq job object so it prints to console via job.log
      await processJob({ data: user, log: (msg) => {} });
      console.log(pc.bgGreen(pc.white(` ✔ Finished User: ${user.user_id} `)));
    } catch (err) {
      console.error(pc.bgRed(pc.white(` ✖ Failed User ${user.user_id}: ${err.message} `)));
    }
  }

  console.log(pc.bgGreen(pc.white("\n Manual trigger complete! ")));
  process.exit(0);
}

triggerManualScrape();
