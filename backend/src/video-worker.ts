import { Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "./config/db";
import { processVideo } from "./modules/video/video.processor";
import { VideoJobData } from "./modules/video/video.queue";

// Suppress pg driver deprecation warning
process.on('warning', (warning: any) => {
  if (warning.name === 'DeprecationWarning' && 
      warning.code === 'DEP0003' &&
      warning.message.includes('Calling client.query()')) {
    return;
  }
  console.warn(warning);
});

// Create Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

console.log("Starting video processing worker...");

// Create BullMQ worker
const videoWorker = new Worker<VideoJobData>(
  "video-processing",
  async (job) => {
    console.log(`[JOB ${job.id}] Starting...`);
    
    const { videoId, objectName, bucket } = job.data;
    let completed = false; // Flag to track completion
    
try {
      const existingVideo = await prisma.video.findUnique({
        where: { id: videoId },
      });
      
      if (!existingVideo) {
        // Video record doesn't exist - this is an ORPHANED job
        // This can happen if:
        // 1. Database was reset after job was queued
        // 2. Video was deleted before processing
        // 3. Video creation failed but job was still queued
        // 
        // We should NOT fail the job (that would cause retry loops)
        // Instead, return a "success" to remove from queue
        console.error(`[JOB ${job.id}] Video ${videoId} not found - ORPHANED JOB!`);
        console.error(`[JOB ${job.id}] Skipping processing (job was queued but video record missing)`);
        console.error(`[JOB ${job.id}] To fix: either recreate the video upload or clean up old jobs in Redis`);
        
        // Return success to remove job from queue (otherwise it will retry forever)
        return {
          success: true,
          outputPath: "",
          error: "Orphaned job - video record not found",
        };
      }
      
      console.log(`[JOB ${job.id}] Found video ${videoId} in database`);
      
      // Initialize progress to 0%
      await prisma.video.update({
        where: { id: videoId },
        data: { progress: 0, status: "PROCESSING" },
      });
      console.log(`[JOB ${job.id}] Initialized: progress=0%, status=PROCESSING`);
      
      console.log(`[JOB ${job.id}] Calling processVideo...`);
      
      // Process the video with progress callback
      const result = await processVideo(job.data, async (progress: number) => {
        // Only update progress if not completed yet
        if (!completed) {
          await prisma.video.update({
            where: { id: videoId },
            data: { progress: progress, status: "PROCESSING" },
          });
          console.log(`[PROGRESS] Video ${videoId}: ${progress}%`);
        }
      });
      
      console.log(`[JOB ${job.id}] processVideo returned: success=${result.success}`);
      
if (result.success) {
        // Mark as COMPLETED
        completed = true;
        
        console.log(`[JOB ${job.id}] Updating to COMPLETED...`);
        
        // Keep original video path, store HLS output in hlsPath
        await prisma.video.update({
          where: { id: videoId },
          data: {
            hlsPath: result.outputPath,
            duration: result.duration,
            status: "COMPLETED",
            progress: 100,
          },
        });
        
        console.log(`[JOB ${job.id}] DONE - marked COMPLETED`);
      } else {
        completed = true;
        
        console.log(`[JOB ${job.id}] FAILED - ${result.error}`);
        
        await prisma.video.update({
          where: { id: videoId },
          data: {
            status: "FAILED",
            progress: 0,
          },
        });
        
        throw new Error(result.error || "Processing failed");
      }
      
      return result;
    } catch (error) {
      console.error(`[JOB ${job.id}] ERROR:`, error);
      
      if (!completed) {
        completed = true;
        try {
          await prisma.video.update({
            where: { id: videoId },
            data: {
              status: "FAILED",
              progress: 0,
            },
          });
        } catch (e) {
          console.error(`[JOB ${job.id}] Failed to update FAILED status:`, e);
        }
      }
      
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

// Handle worker events
videoWorker.on("completed", (job) => {
  console.log(`[BULLMQ] Job ${job.id} completed`);
});

videoWorker.on("failed", (job, error) => {
  console.error(`[BULLMQ] Job ${job?.id} failed:`, error.message);
});

videoWorker.on("error", (error) => {
  console.error("[BULLMQ] Worker error:", error);
});

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing worker...");
  await videoWorker.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing worker...");
  await videoWorker.close();
  await redisConnection.quit();
  process.exit(0);
});

console.log("Video processing worker started");
