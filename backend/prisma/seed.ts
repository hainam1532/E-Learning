import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL!;
const connectionString = String(databaseUrl);

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { usercode: 'ADMIN001' },
    update: {},
    create: {
      usercode: 'ADMIN001',
      email: 'admin@example.com',
      password: hashedPassword,
      fullName: 'Administrator',
      role: 'ADMIN',
    },
  });

  console.log('Created admin user:', admin);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
