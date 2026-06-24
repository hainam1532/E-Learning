require('dotenv').config();
const pg = require('pg');

const c = new pg.Client(process.env.DATABASE_URL);

c.connect()
  .then(async () => {
    console.log('Testing database query...\n');
    
    // Check learning_progress table
    const progresses = await c.query(`
      SELECT 
        lp.id, lp."lessonId", l."videoId" as "lessonVideoId", v.name as "videoName"
      FROM "learning_progress" lp
      JOIN "lessons" l ON l.id = lp."lessonId"
      LEFT JOIN "videos" v ON v.id = l."videoId"
      ORDER BY lp.id
    `);
    
    console.log('=== Progress entries with video info ===');
    for (const row of progresses.rows) {
      console.log(`Progress ${row.id}: lessonId=${row.lessonId}, lessonVideoId=${row.lessonVideoId}, videoName="${row.videoName}"`);
    }
    
    // Check videos that are linked to lessons
    console.log('\n=== Videos linked to lessons ===');
    const videos = await c.query(`
      SELECT v.id, v.name, l.id as "lessonId", l.title as "lessonTitle"
      FROM "videos" v
      JOIN "lessons" l ON l."videoId" = v.id
      ORDER BY v.id
    `);
    
    for (const row of videos.rows) {
      console.log(`Video ${row.id}: "${row.videoName}", lessonId=${row.lessonId}, lessonTitle="${row.lessonTitle}"`);
    }
    
    c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });
