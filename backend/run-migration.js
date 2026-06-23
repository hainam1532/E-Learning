require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function main() {
  // Create a connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  
  const migrationPath = path.join(__dirname, 'prisma/migrations/20260623000000_add_training_tables/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Running migration...');
  
  try {
    // Execute each statement separately
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await pool.query(statement);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

main();
