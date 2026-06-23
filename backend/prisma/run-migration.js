require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();
  
  const migrationPath = path.join(__dirname, 'prisma/migrations/20260623000000_add_training_tables/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Running migration...');
  console.log('SQL:', sql);
  
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
