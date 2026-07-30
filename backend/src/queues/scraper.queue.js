const { Queue } = require("bullmq");
const { connection } = require("../config/redis");

const scraperQueue = new Queue("scraperQueue", { connection });

async function addScrapeJob(userRow) {
  // Prevent duplicate jobs for the same user if they are already in queue
  await scraperQueue.add("scrapeLinkedIn", userRow, {
    jobId: `scrape-${userRow.user_id}-${Date.now()}`,
    removeOnComplete: true,
    removeOnFail: 100 // Keep last 100 failed jobs for debugging
  });
}

module.exports = { scraperQueue, addScrapeJob };
