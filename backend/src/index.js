require("dotenv").config();

// Ensure config components are instantiated
require("./config/redis");
require("./config/supabase");

// Initialize Workers
require("./workers/scraper.worker");
require("./workers/batchSend.worker");

// Start Scheduler
const { startScheduler } = require("./scheduler");
const { supabase } = require("./config/supabase");

const express = require("express");
const cors = require("cors");
const linkedinRoutes = require("./routes/linkedin");

// Initialize Express Server
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/linkedin", linkedinRoutes);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend Express Server running on port ${PORT}`);
});

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
