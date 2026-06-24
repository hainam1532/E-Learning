require('dotenv').config();
const pg = require('pg');

const c = new pg.Client(process.env.DATABASE_URL);

c.connect()
  .then(() => {
    console.log('Connected to database');
    // Query all learning_progress with lesson, video, and course
    return c.query(`
      SELECT 
        lp.id,
        lp."lessonId",
        lp."userId",
        lp."watchedSeconds",
        lp.completed,
        lp."updatedAt",
        l.title as lesson_title,
        l."courseId",
        l."videoId",
        v.name as video_name,
        v.path as video_path,
        c.title_vi as course_title_vi
      FROM "learning_progress" lp
      JOIN "lessons" l ON l.id = lp."lessonId"
      LEFT JOIN "videos" v ON v.id = l."videoId"
      LEFT JOIN "courses" c ON c.id = l."courseId"
      ORDER BY lp."updatedAt" DESC
    `);
  })
  .then(r => {
    console.log('\n=== Watch History (Learning Progress) ===');
    r.rows.forEach(row => {
      console.log(`\nProgress ${row.id} (user ${row.userId}):`);
      console.log(`  lessonId: ${row.lessonId}, lesson_title: "${row.lesson_title}"`);
      console.log(`  videoId: ${row.videoId}, video_name: "${row.video_name}"`);
      console.log(`  video_path: "${row.video_path}"`);
      console.log(`  courseId: ${row.courseId}, course: "${row.course_title_vi}"`);
      console.log(`  watched: ${row.watchedSeconds}s, completed: ${row.completed}`);
    });
    console.log('\nTotal:', r.rows.length, 'progress records');
    c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });
