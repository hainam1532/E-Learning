import { Queue, Job } from "bullmq";
import IORedis from "ioredis";

// Video processing job data
export interface VideoJobData {
  videoId: number;
  lessonId: number;
  originalFileName: string;
  objectName: string;
  bucket: string;
}

// Create Redis connection for BullMQ
const createRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
};

// Create video processing queue
export const createVideoQueue = (redisConnection: IORedis) => {
  return new Queue<VideoJobData>("video-processing", {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
};

// Add video processing job to queue
export async function addVideoProcessingJob(
  queue: Queue<VideoJobData>,
  videoData: VideoJobData
): Promise<Job<VideoJobData>> {
  return queue.add("process-video", videoData);
}

// Get video queue counts
export async function getVideoQueueCounts(queue: Queue<VideoJobData>) {
  return {
    waiting: await queue.getWaitingCount(),
    active: await queue.getActiveCount(),
    completed: await queue.getCompletedCount(),
    failed: await queue.getFailedCount(),
  };
}

// Close video queue
export async function closeVideoQueue(queue: Queue<VideoJobData>): Promise<void> {
  await queue.close();
}
