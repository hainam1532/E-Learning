require('dotenv').config();
const pg = require('pg');

const c = new pg.Client(process.env.DATABASE_URL);

c.connect()
  .then(() => {
    console.log('Connected to database');
    // Check lessons table
    return c.query(`
      SELECT l.id, l.title, l."courseId", l."videoId", v.name as "videoName", v.path as "videoPath"
      FROM "lessons" l
      LEFT JOIN "videos" v ON v.id = l."videoId"
      ORDER BY l.id
    `);
  })
  .then(r => {
    console.log('\n=== Lessons ===');
    r.rows.forEach(row => {
      console.log(`Lesson ${row.id}: title="${row.title}", courseId=${row.courseId}, videoId=${row.videoId}, videoName="${row.videoName}"`);
    });
    c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });
