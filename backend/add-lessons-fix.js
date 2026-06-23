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
    // Step 1: Check if "videoId" column exists in lessons table
    const colCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'lessons' AND column_name = 'videoId'
    `);
    
    // Add videoId column if it doesn't exist
    if (colCheck.rows.length === 0) {
      console.log('Adding videoId column to lessons table...');
      await pool.query(`
        ALTER TABLE lessons ADD COLUMN "videoId" INT REFERENCES videos(id)
      `);
      console.log('Added videoId column');
    } else {
      console.log('videoId column already exists');
    }
    
    console.log('Creating lessons for courses with videos but no lessons...');
    
    // Step 2: Create lessons for courses that have videos but no lessons
    const result = await pool.query(`
      INSERT INTO lessons (title, "courseId", "videoId", "order")
      SELECT 
        COALESCE(v.name, 'Video ' || cv.order::text) as title,
        cv."courseId",
        cv."videoId",
        cv."order"
      FROM "course_videos" cv
      LEFT JOIN "lessons" l ON cv."courseId" = l."courseId" AND cv."videoId" = l."videoId"
      JOIN "videos" v ON cv."videoId" = v.id
      WHERE l.id IS NULL
      ORDER BY cv."courseId", cv."order"
      ON CONFLICT DO NOTHING
      RETURNING id, title, "courseId", "videoId"
    `);
    
    console.log(`Created ${result.rowCount} lessons`);
    
    if (result.rowCount > 0) {
      console.log('New lessons:');
      result.rows.forEach(row => {
        console.log(`  - Course ${row.courseId}: ${row.title} (videoId: ${row.videoId})`);
      });
    }
    
    // Verify: Show courses and their lesson counts
    console.log('\n--- Course Progress Status ---');
    const verifyResult = await pool.query(`
      SELECT 
        c.id as "courseId",
        c."title_vi" as "courseTitle",
        COUNT(DISTINCT cv.id) as "totalVideos",
        COUNT(DISTINCT l.id) as "totalLessons"
      FROM "courses" c
      LEFT JOIN "course_videos" cv ON c.id = cv."courseId"
      LEFT JOIN "lessons" l ON c.id = l."courseId"
      GROUP BY c.id, c."title_vi"
      HAVING COUNT(DISTINCT cv.id) > 0
      ORDER BY c.id
      LIMIT 20
    `);
    
    verifyResult.rows.forEach(row => {
      console.log(`Course ${row.courseId}: ${row.courseTitle} - Videos: ${row.totalVideos}, Lessons: ${row.totalLessons}`);
    });
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
