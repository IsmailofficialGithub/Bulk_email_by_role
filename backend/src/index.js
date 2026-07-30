require("dotenv").config();

// Ensure config components are instantiated
require("./config/redis");
require("./config/supabase");

// Initialize Queues and Workers
require("./queues/scraper.queue");
require("./workers/scraper.worker");

// Start Scheduler
const { startScheduler } = require("./scheduler");

console.log("🚀 Backend Scraper Service Initialized");
startScheduler();
