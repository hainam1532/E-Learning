require('dotenv').config();
const { Pool } = require('pg');

// Same logic as getWatchHistory in progress.controller
async function testGetWatchHistory(userId) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // This is the exact query from progress.controller.ts getWatchHistory function
    const progresses = await pool.query(`
      SELECT 
        lp.id,
        lp."lessonId",
        lp."watchedSeconds",
        lp.completed,
        lp."updatedAt",
        l.title as lesson_title,
        l."courseId",
        v.id as video_id,
        v.name as video_name,
        v."thumbnailUrl",
        v.duration as video_duration,
        c.id as course_id,
        c.title_vi as course_title_vi,
        c.title_en as course_title_en,
        c.title_zh as course_title_zh,
        c."coverImage"
      FROM "learning_progress" lp
      JOIN "lessons" l ON l.id = lp."lessonId"
      LEFT JOIN "videos" v ON v.id = l."videoId"
      LEFT JOIN "courses" c ON c.id = l."courseId"
      WHERE lp."userId" = $1
      ORDER BY lp."updatedAt" DESC
      LIMIT 50
    `, [userId]);

    console.log('\n=== Simulating getWatchHistory API response ===\n');
    
    progresses.rows.forEach((progress) => {
      const video = progress.video_id ? {
        id: progress.video_id,
        name: progress.video_name,
        duration: progress.video_duration,
        thumbnailUrl: progress.thumbnailUrl,
      } : null;
      
      const course = progress.course_id ? {
        id: progress.course_id,
        title_vi: progress.course_title_vi,
        title_en: progress.course_title_en,
        title_zh: progress.course_title_zh,
        coverImage: progress.coverImage,
      } : null;
      
      console.log('Progress entry:');
      console.log('  id:', progress.id);
      console.log('  lessonId:', progress.lessonId);
      console.log('  videoId:', progress.video_id);
      console.log('  video.name:', video?.name);
      console.log('  course.title_vi:', course?.title_vi);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Test with userId = 2 (the user in the progress data)
testGetWatchHistory(2);
