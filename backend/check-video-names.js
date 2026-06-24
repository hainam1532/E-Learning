require('dotenv').config();
const pg = require('pg');

const c = new pg.Client(process.env.DATABASE_URL);

c.connect()
  .then(() => {
    console.log('Connected to database');
    // First, show current video names
    return c.query(`
      SELECT v.id, v.name, v.path, l.id as lesson_id, l.title as lesson_title
      FROM videos v
      LEFT JOIN lessons l ON l."videoId" = v.id
      ORDER BY v.id
      LIMIT 10
    `);
  })
  .then(r => {
    console.log('\n=== Current Videos and Lessons ===');
    r.rows.forEach(row => {
      console.log(`Video ${row.id}: name="${row.name}" | path="${row.path}"`);
      console.log(`  Lesson ${row.lesson_id}: title="${row.lesson_title}"`);
    });
    console.log('\nTotal:', r.rows.length, 'videos');
    c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });
