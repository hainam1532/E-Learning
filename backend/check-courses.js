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
    // Check courses with academyId
    const coursesResult = await pool.query(`
      SELECT 
        c.id, 
        c.title_vi, 
        c."academyId",
        a.name_vi as "academyName"
      FROM courses c
      LEFT JOIN academies a ON c."academyId" = a.id
      ORDER BY c.id
    `);
    
    console.log('=== Courses ===');
    coursesResult.rows.forEach(row => {
      console.log(`Course ${row.id}: ${row.title_vi} | academyId: ${row.academyId} (${row.academyName})`);
    });
    
    // Check lessons for each course  
    const lessonsResult = await pool.query(`
      SELECT id, title, "courseId", "videoId" FROM lessons ORDER BY "courseId", "order"
    `);
    
    console.log('\n=== Lessons ===');
    lessonsResult.rows.forEach(row => {
      console.log(`Lesson ${row.id}: ${row.title} | courseId: ${row.courseId} | videoId: ${row.videoId}`);
    });
    
    // Check learning_progress
    const progressResult = await pool.query(`
      SELECT id, "userId", "lessonId", "watchedSeconds", completed FROM learning_progress
    `);
    
    console.log('\n=== Learning Progress ===');
    console.log(`Total: ${progressResult.rowCount} records`);
    progressResult.rows.forEach(row => {
      console.log(`Progress ${row.id}: userId=${row.userId}, lessonId=${row.lessonId}, watched=${row.watchedSeconds}s, completed=${row.completed}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
