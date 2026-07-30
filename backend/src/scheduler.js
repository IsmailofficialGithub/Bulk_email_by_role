const pc = require("picocolors");
const { supabase } = require("./config/supabase");
const { processJob } = require("./workers/scraper.worker");
const { runAutomailJobs } = require("./workers/automail.worker");

const { addBatchSendJob } = require("./queues/batchSend.queue");

const lastQueuedMap = new Map();

async function checkBatchSends() {
  const { data: users, error } = await supabase
    .from("automailsend_app_state")
    .select("*")
    .eq("batch_send_pending", true)
    .eq("batch_send_processing", false);

  if (error) {
    console.error(pc.red(`[Scheduler] Error fetching batch send users: ${error.message}`));
    return;
  }
  
  console.log(pc.dim(`  -> Result: Found ${users ? users.length : 0} pending batch jobs.`));

  for (const user of users || []) {
    console.log(pc.cyan(`✨ [Scheduler] Triggering manual batch send for user ${user.user_id.split('-')[0]}...`));
    
    // Mark as processing
    await supabase.from("automailsend_app_state")
      .update({ batch_send_processing: true })
      .eq("user_id", user.user_id);
    
    await addBatchSendJob(user);
  }
}

function startScheduler() {
  const tickSec = process.env.SCHEDULER_INTERVAL_SEC ? parseInt(process.env.SCHEDULER_INTERVAL_SEC, 10) : 10;
  console.log(pc.green(`🚀 Starting Auto-Apply Scheduler (checking every ${tickSec} seconds)...`));

  const automailTickSec = process.env.AUTOMAIL_WORKER_INTERVAL_SEC ? parseInt(process.env.AUTOMAIL_WORKER_INTERVAL_SEC, 10) : 10;
  console.log(pc.green(`🚀 Starting Automail Worker (checking every ${automailTickSec} seconds)...`));
  setInterval(async () => {
    console.log(pc.dim(`[Automail Worker] Checking for pending background emails...`));
    runAutomailJobs(supabase).catch(err => {
      console.error(pc.red(`[Scheduler] Automail worker error: ${err.message}`));
    });
  }, automailTickSec * 1000);

  const batchTickSec = process.env.BATCH_INTERVAL_SEC ? parseInt(process.env.BATCH_INTERVAL_SEC, 10) : 10;
  console.log(pc.green(`🚀 Starting Batch Send Worker (checking every ${batchTickSec} seconds)...`));
  setInterval(async () => {
    console.log(pc.dim(`[BatchSend Worker] Checking for pending manual batches...`));
    checkBatchSends().catch(err => {
      console.error(pc.red(`[Scheduler] Batch Send error: ${err.message}`));
    });
  }, batchTickSec * 1000);

  setInterval(async () => {
    // or just log it so the user knows it's checking.
    console.log(pc.dim(`[Scheduler] Checking for users due for scraping...`));

    const { data: users, error } = await supabase
      .from("automailsend_app_state")
      .select("*")
      .eq("auto_fetch_enabled", true);

    if (error) {
      console.error(pc.red(`[Scheduler] Error fetching users: ${error.message}`));
      return;
    }

    if (!users || users.length === 0) {
      console.log(pc.dim(`[Scheduler] No active users with auto_fetch_enabled=true found.`));
      return;
    }

    for (const user of users) {
      try {
        const intervalMin = user.auto_fetch_interval_min || 5;
        
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
            const remaining = intervalMin - diffMin;
            // Only log if we are close to running or just checking to avoid too much spam, but the user requested it.
            console.log(pc.yellow(`[Scheduler] User ${user.user_id.split('-')[0]}... skipping. ${remaining.toFixed(1)}m remaining.`));
          }
        }

        // Check local memory throttle (prevent infinite loop while waiting for DB insert)
        const lastQueued = lastQueuedMap.get(user.user_id) || 0;
        const nowMs = new Date().getTime();
        // Prevent queuing the exact same user more than once every 60 seconds locally
        if (nowMs - lastQueued < 60000) {
          shouldRun = false; 
        }

        if (shouldRun) {
          lastQueuedMap.set(user.user_id, nowMs);
          
          // IMPORTANT: Bypass Redis/BullMQ entirely by executing the worker directly in the Node process.
          // This prevents infinite hangs on Windows machines that do not have a local Redis server running.
          console.log(pc.cyan(`✨ [Scheduler] Triggering job for user ${user.user_id.split('-')[0]}... (interval reached)`));
          
          processJob({ data: user }).catch(err => {
             console.error(pc.red(`[Scheduler/Worker] Job failed: ${err.message}`));
          });
        }
      } catch (err) {
        console.error(pc.red(`[Scheduler] Failed to process user ${user.user_id}: ${err.message}`));
      }
    }
  }, tickSec * 1000);
}

module.exports = { startScheduler };
