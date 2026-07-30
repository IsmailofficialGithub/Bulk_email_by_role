const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
});
// if connection success then log else log error with red color
connection.on("connect", () => {
  console.log("Redis connected");
});

connection.on("error", (error) => {
  console.log("Redis connection error", error);
});

module.exports = { connection };
