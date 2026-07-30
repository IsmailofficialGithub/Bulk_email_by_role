const { Queue } = require("bullmq");
const { connection } = require("../config/redis");

const batchSendQueue = new Queue("batchSendQueue", { connection });

async function addBatchSendJob(userRow) {
  await batchSendQueue.add("batchSend", userRow, {
    jobId: `batch-send-${userRow.user_id}-${Date.now()}`,
    removeOnComplete: true,
    removeOnFail: 100
  });
}

module.exports = { batchSendQueue, addBatchSendJob };
