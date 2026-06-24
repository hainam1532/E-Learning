require('dotenv').config();
const pg = require('pg');

const c = new pg.Client(process.env.DATABASE_URL);

c.connect()
  .then(async () => {
    console.log('Debugging video names...\n');
    
    // Get all unique videos
    const videos = await c.query(`
      SELECT id, name, path, bucket
      FROM "videos"
      ORDER BY id
    `);
    
    console.log('=== ALL VIDEOS ===');
    for (const v of videos.rows) {
      console.log(`Video ${v.id}: name="${v.name}", path="${v.path}"`);
    }
    
    // Get all lessons with video IDs
    console.log('\n=== ALL LESSONS ===');
    const lessons = await c.query(`
      SELECT id, title, "courseId", "videoId"
      FROM "lessons"
      ORDER BY id
    `);
    
    for (const l of lessons.rows) {
      console.log(`Lesson ${l.id}: title="${l.title}", videoId=${l.videoId}`);
    }
    
    c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });
