/**
 * Cleanup script to remove orphaned video processing jobs from the queue
 * Run with: npx ts-node src/cleanup-queue.ts
 */
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new IORedis(redisUrl);

async function cleanupQueue() {
  try {
    console.log("Cleaning up video processing queue...");
    
    // Get all keys related to video-processing
    const keys = await redis.keys("bull:video-processing:*");
    console.log("Found " + keys.length + " keys to delete");
    
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log("Deleted all video-processing queue keys");
    }
    
    // Also clean up any delayed jobs
    const delayedKeys = await redis.keys("bull:video-processing:delayed:*");
    console.log("Found " + delayedKeys.length + " delayed job keys");
    
    if (delayedKeys.length > 0) {
      await redis.del(...delayedKeys);
      console.log("Deleted delayed job keys");
    }
    
    console.log("Queue cleanup complete!");
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning up queue:", error);
    process.exit(1);
  }
}

cleanupQueue();
