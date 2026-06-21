import app from "./app";
import { redisClient } from "./config/redis";

const PORT = 5000;

async function main() {
  await redisClient.connect();

  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

main().catch(console.error);