const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
});
// if connection success then log else log error with red color
connection.on("connect", () => {
  console.log("Redis connected");
});

let errorLogged = false;
connection.on("error", (error) => {
  if (!errorLogged) {
    console.log("Redis connection error (logging once to prevent spam):", error.message);
    errorLogged = true;
  }
});

module.exports = { connection };
