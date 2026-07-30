const pc = require("picocolors");
const { supabase } = require("./config/supabase");
const { addScrapeJob } = require("./queues/scraper.queue");

const lastQueuedMap = new Map();

function startScheduler() {
  const tickSec = 10; // Check every 10 seconds
  console.log(pc.bgGreen(pc.white(` Starting Auto-Apply Scheduler (checking every ${tickSec} seconds)... `)));

  setInterval(async () => {

    
    const { data: users, error } = await supabase
      .from("automailsend_app_state")
      .select("*")
      .eq("auto_fetch_enabled", true);

    if (error) {
      console.error(pc.bgRed(pc.white(` [Scheduler] Error fetching users: ${error.message} `)));
      return;
    }

    if (!users || users.length === 0) {
      return;
    }

    for (const user of users) {
      try {
        const intervalMin = user.auto_fetch_interval_min || 60;
        
        // Fetch last execution for this user
        const { data: logs } = await supabase
          .from("automailsend_execution_logs")
          .select("created_at")
          .eq("user_id", user.user_id)
          .order("created_at", { ascending: false })
          .limit(1);

        let shouldRun = true;
        
        if (logs && logs.length > 0) {
          const lastExecTime = new Date(logs[0].created_at).getTime();
          const now = new Date().getTime();
          const diffMin = (now - lastExecTime) / (1000 * 60);
          
          if (diffMin < intervalMin) {
            shouldRun = false;
          }
        }

        // Check local memory throttle (prevent infinite loop while waiting for DB insert)
        const lastQueued = lastQueuedMap.get(user.user_id) || 0;
        const now = new Date().getTime();
        if (now - lastQueued < 60000) {
          shouldRun = false; // Don't queue more than once a minute
        }

        if (shouldRun) {
          lastQueuedMap.set(user.user_id, now);
          await addScrapeJob(user);
          console.log(pc.bgCyan(pc.black(` [Scheduler] Queued job for user ${user.user_id} (interval ${intervalMin}m reached) `)));
        }
      } catch (err) {
        console.error(pc.bgRed(pc.white(` [Scheduler] Failed to process user ${user.user_id}: ${err.message} `)));
      }
    }
  }, tickSec * 1000);
}

module.exports = { startScheduler };
