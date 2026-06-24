require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  console.log('Checking learning_progress table...\n');
  
  // Get all progress entries
  const progresses = await pool.query(`
    SELECT lp.id, lp."userId", lp."lessonId", lp."watchedSeconds", lp.completed, lp."updatedAt"
    FROM "learning_progress" lp
    ORDER BY lp.id
  `);
  
  console.log(`Total progress entries: ${progresses.rows.length}`);
  for (const row of progresses.rows) {
    console.log(`Progress ${row.id}: userId=${row.userId}, lessonId=${row.lessonId}, watchedSeconds=${row.watchedSeconds}, completed=${row.completed}`);
  }
  
  // Get all users
  const users = await pool.query(`SELECT id, usercode FROM "users" ORDER BY id`);
  console.log(`\nTotal users: ${users.rows.length}`);
  for (const row of users.rows) {
    console.log(`User ${row.id}: usercode="${row.usercode}"`);
  }
  
  // Get specific lessons for progress 2 and 3
  const progress2 = await pool.query(`
    SELECT l.id, l.title, l."courseId", l."videoId"
    FROM "lessons" l WHERE l.id IN (1, 2)
  `);
  console.log('\n=== Lessons 1 and 2 ===');
  for (const row of progress2.rows) {
    console.log(`Lesson ${row.id}: title="${row.title}", videoId=${row.videoId}`);
  }
  
  await pool.end();
}

test().catch(e => {
  console.error('Error:', e);
  pool.end();
});
