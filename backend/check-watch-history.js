require('dotenv').config();
const pg = require('pg');

const c = new pg.Client(process.env.DATABASE_URL);

c.connect()
  .then(() => {
    console.log('Connected to database');
    // First check column names
    return c.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'learning_progress'
      ORDER BY ordinal_position
    `);
  })
  .then(r => {
    console.log('\n=== Columns in learning_progress ===');
    r.rows.forEach(row => {
      console.log('- ' + row.column_name);
    });
    c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });
