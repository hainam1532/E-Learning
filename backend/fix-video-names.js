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
    console.log('Checking and fixing video names...\n');
    
    // Step 1: Update videos table - set name from file path if name is null/empty
    const updateVideosResult = await pool.query(`
      UPDATE videos 
      SET name = COALESCE(name, 
        CASE 
          WHEN path LIKE '%.mp4' THEN substring(path from '([^/]+)\.mp4$')
          WHEN path LIKE '%.m3u8' THEN substring(path from '([^/]+)\.m3u8$')
          ELSE 'Video ' || id::text
        END
      )
      WHERE name IS NULL OR name = ''
      RETURNING id, name, path
    `);
    
    console.log(`Updated ${updateVideosResult.rowCount} videos in videos table`);
    if (updateVideosResult.rowCount > 0) {
      updateVideosResult.rows.forEach(row => {
        console.log(`  Video ${row.id}: ${row.name} (from ${row.path})`);
      });
    }
    
    // Step 2: Update lessons table - set title from video name if title is null/empty
    const updateLessonsResult = await pool.query(`
      UPDATE lessons l
      SET title = COALESCE(l.title, v.name, 'Video ' || l.id::text)
      FROM videos v
      WHERE l."videoId" = v.id 
      AND (l.title IS NULL OR l.title = '' OR l.title LIKE 'Video %')
      AND v.name IS NOT NULL AND v.name != ''
      RETURNING l.id, l.title, v.name as "videoName"
    `);
    
    console.log(`\nUpdated ${updateLessonsResult.rowCount} lessons with video names`);
    if (updateLessonsResult.rowCount > 0) {
      updateLessonsResult.rows.forEach(row => {
        console.log(`  Lesson ${row.id}: ${row.title} <- Video: ${row.videoName}`);
      });
    }
    
    // Step 3: Show current status
    console.log('\n--- Current Video Names ---');
    const statusResult = await pool.query(`
      SELECT 
        v.id as "videoId",
        v.name as "videoName",
        v.path,
        l.id as "lessonId",
        l.title as "lessonTitle"
      FROM videos v
      LEFT JOIN lessons l ON l."videoId" = v.id
      ORDER BY v.id
      LIMIT 20
    `);
    
    statusResult.rows.forEach(row => {
      console.log(`Video ${row.videoId}: "${row.videoName}" | Lesson ${row.lessonId}: "${row.lessonTitle}"`);
    });
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
