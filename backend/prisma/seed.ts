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

  // Create default course categories
  const categories = [
    { code: 'SUSTAINABILITY', name_vi: 'Bền vững', name_en: 'Sustainability', name_zh: '可持续性' },
    { code: 'LEADERSHIP', name_vi: 'Khả năng lãnh đạo', name_en: 'Leadership', name_zh: '领导力' },
    { code: 'CREATIVITY', name_vi: 'Sáng tạo', name_en: 'Creativity', name_zh: '创新' },
    { code: 'DIGITAL', name_vi: 'Số hóa', name_en: 'Digital Transformation', name_zh: '数字化' },
    { code: 'SOFT_SKILLS', name_vi: 'Kỹ năng mềm', name_en: 'Soft Skills', name_zh: '软技能' },
    { code: 'TECHNICAL', name_vi: 'Kỹ thuật', name_en: 'Technical', name_zh: '技术' },
    { code: 'MANAGEMENT', name_vi: 'Quản lý', name_en: 'Management', name_zh: '管理' },
    { code: 'COMMUNICATION', name_vi: 'Giao tiếp', name_en: 'Communication', name_zh: '沟通' },
    { code: 'TEAMWORK', name_vi: 'Làm việc nhóm', name_en: 'Teamwork', name_zh: '团队合作' },
    { code: 'PROBLEM_SOLVING', name_vi: 'Giải quyết vấn đề', name_en: 'Problem Solving', name_zh: '解决问题' },
  ];

  for (const cat of categories) {
    await prisma.courseCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }

  console.log('Created default course categories');
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
