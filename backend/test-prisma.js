require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function main() {
  const connectionString = String(databaseUrl);
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  
  console.log('Testing Prisma query...');
  console.log('Database URL:', databaseUrl.substring(0, 30) + '...');
  
  try {
    // Query using Prisma - trainingClasses
    console.log('\nQuery 1: prisma.trainingClass.findMany()');
    const classes = await prisma.trainingClass.findMany();
    console.log('Result:', classes);
    
    // Query using Prisma - trainingPlans
    console.log('\nQuery 2: prisma.trainingPlan.findMany()');
    const plans = await prisma.trainingPlan.findMany();
    console.log('Result:', plans);
    
    console.log('\n✅ All queries successful!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
