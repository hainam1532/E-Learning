import app from "./app";
import { redisClient } from "./config/redis";
import { prisma } from "./config/db";

const PORT = 5000;

// Suppress pg driver deprecation warning - this is a known issue with pg@8.x adapter
process.on('warning', (warning: any) => {
  if (warning.name === 'DeprecationWarning' && 
      warning.code === 'DEP0003' &&
      warning.message.includes('Calling client.query()')) {
    return;
  }
  console.warn(warning);
});

async function main() {
  // Test Redis connection
  await redisClient.connect();

  // Test and retry database connection
  const maxRetries = 5;
  const retryInterval = 5000; // 5 seconds
  let retries = 0;
  let dbConnected = false;

  while (retries < maxRetries && !dbConnected) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('Successfully connected to the database.');
      dbConnected = true;
    } catch (error: any) {
      retries++;
      console.error(`Database connection attempt ${retries} failed: ${error.message}`);
      if (retries < maxRetries) {
        console.log(`Retrying database connection in ${retryInterval / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
  }

  if (!dbConnected) {
    console.error('Failed to connect to the database after maximum retries. Exiting.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

main().catch(console.error);
