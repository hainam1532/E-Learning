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
    // Check table schema
    const result = await pool.query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_name LIKE 'training%'
    `);
    
    console.log('Training tables with schema:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Also show the current database name
    const dbResult = await pool.query('SELECT current_database()');
    console.log('\nCurrent database:', dbResult.rows[0]);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
