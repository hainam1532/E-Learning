import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Get database URL and ensure it's a string
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Ensure password is properly encoded as string
// The SCRAM authentication requires password to be a string, not a number or other type
const connectionString = String(databaseUrl);

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});
