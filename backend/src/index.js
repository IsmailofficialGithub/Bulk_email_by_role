require("dotenv").config();

// Ensure config components are instantiated
require("./config/redis");
require("./config/supabase");

// Initialize Queues and Workers
require("./queues/scraper.queue");
require("./workers/scraper.worker");
require("./queues/batchSend.queue");
require("./workers/batchSend.worker");

// Start Scheduler
const { startScheduler } = require("./scheduler");
const { supabase } = require("./config/supabase");

console.log("🚀 Backend Scraper Service Initialized");
startScheduler();

// Graceful Shutdown Handler
async function gracefulShutdown(signal, error = null) {
  console.log(`\n🛑 Received ${signal}. Running graceful shutdown...`);
  if (error) console.error("Crash details:", error);
  
  try {
    // 1. Reset all stuck batch_send_processing locks
    await supabase.from("automailsend_app_state")
      .update({ batch_send_processing: false })
      .eq("batch_send_processing", true);
      
    // 2. Mark any 'running' scraper executions as 'failed'
    await supabase.from("automailsend_execution_logs")
      .update({ status: "failed", error_message: `Server stopped unexpectedly (${signal})` })
      .eq("status", "running");
      
    console.log("✅ Database locks and statuses safely reset.");
  } catch (err) {
    console.error("❌ Error during shutdown reset:", err.message);
  }
  
  process.exit(error ? 1 : 0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("uncaughtException", (err) => gracefulShutdown("uncaughtException", err));
process.on("unhandledRejection", (reason) => gracefulShutdown("unhandledRejection", reason));
