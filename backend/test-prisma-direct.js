require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  console.log('Testing getWatchHistory query...\n');
  
  // Same query as getWatchHistory in progress.controller.ts
  const userId = 1;
  
  const progresses = await pool.query(`
    SELECT 
      lp.id, lp."lessonId", lp."watchedSeconds", lp.completed, lp."updatedAt",
      l.id as "lesson_id", l.title as "lesson_title", l."courseId" as "lesson_courseId",
      v.id as "video_id", v.name as "video_name", v."thumbnailUrl", v.duration,
      c.id as "course_id", c."title_vi", c."title_en", c."title_zh", c."coverImage"
    FROM "learning_progress" lp
    JOIN "lessons" l ON l.id = lp."lessonId"
    LEFT JOIN "videos" v ON v.id = l."videoId"
    LEFT JOIN "courses" c ON c.id = l."courseId"
    WHERE lp."userId" = $1
    ORDER BY lp."updatedAt" DESC
    LIMIT 50
  `, [userId]);
  
  console.log('=== Progress entries ===');
  for (const row of progresses.rows) {
    console.log(`Progress ${row.id}: lessonId=${row.lessonId}, videoId=${row.video_id}`);
    console.log(`  video: id=${row.video_id}, name="${row.video_name}"`);
    console.log(`  lesson: id=${row.lesson_id}, title="${row.lesson_title}"`);
    console.log(`  course: id=${row.course_id}, title_vi="${row.title_vi}"`);
  }
  
  await pool.end();
}

test().catch(e => {
  console.error('Error:', e);
  pool.end();
});
