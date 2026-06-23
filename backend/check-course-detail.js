require('dotenv').config();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  
  try {
// Get full course detail for course 1 - matching what API returns
    const courseResult = await pool.query(`
      SELECT 
        c.id,
        c.title_vi,
        c."academyId"
      FROM courses c
      WHERE c.id = 1
    `);
    
    console.log('=== Course data ===');
    courseResult.rows.forEach(row => {
      console.log(`Course ${row.id}: ${row.title_vi} | academyId: ${row.academyId}`);
    });

    // Get courseVideos (videos in course)
    const cvResult = await pool.query(`
      SELECT cv."courseId", cv."videoId", cv."order", v.name
      FROM "course_videos" cv
      JOIN videos v ON cv."videoId" = v.id
      WHERE cv."courseId" = 1
      ORDER BY cv."order"
    `);
    
    console.log('=== courseVideos for Course 1 ===');
    cvResult.rows.forEach((row, idx) => {
      console.log(`[${idx}] videoId: ${row.videoId}, order: ${row.order}, name: ${row.name}`);
    });
    
    // Get lessons
    const lessonsResult = await pool.query(`
      SELECT id, title, "courseId", "videoId", "order"
      FROM lessons
      WHERE "courseId" = 1
      ORDER BY "order"
    `);
    
    console.log('\n=== lessons for Course 1 ===');
    lessonsResult.rows.forEach((row, idx) => {
      console.log(`[${idx}] id: ${row.id}, title: ${row.title}, videoId: ${row.videoId}, order: ${row.order}`);
    });
    
    // Now let's simulate what the frontend does to find currentLesson
    console.log('\n=== Frontend logic simulation ===');
    const videoList = cvResult.rows;
    const lessons = lessonsResult.rows;
    
    // Pick the first video as example
    const currentVideoId = videoList[0].videoId;
    console.log(`Looking for lesson with videoId: ${currentVideoId}`);
    
    // Find index in videoList
    const videoIndex = videoList.findIndex(v => v.videoId === currentVideoId);
    console.log(`videoIndex in videoList: ${videoIndex}`);
    
    // Try to get lesson by index from lessons array
    if (videoIndex >= 0 && lessons[videoIndex]) {
      console.log(`Found lesson by index: ${lessons[videoIndex].title} (id: ${lessons[videoIndex].id})`);
    } else {
      console.log(`ERROR: No lesson at index ${videoIndex}`);
    }
    
    // But the correct way: find by matching videoId
    const correctLesson = lessons.find(l => l.videoId === currentVideoId);
    console.log(`Correct lesson by matching videoId: ${correctLesson?.title} (id: ${correctLesson?.id})`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
