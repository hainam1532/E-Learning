require('dotenv').config();
const pg = require('pg');

const c = new pg.Client(process.env.DATABASE_URL);

c.connect()
  .then(() => {
    console.log('Connected to database');
    return c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  })
  .then(r => {
    console.log('\n=== Tables in database ===');
    r.rows.forEach(row => {
      console.log('- ' + row.table_name);
    });
    console.log('\nTotal:', r.rows.length, 'tables');
    c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });
