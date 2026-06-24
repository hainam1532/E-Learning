require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma query...\n');
  
  // Test 1: Get progresses with lesson and video
  const progresses = await prisma.learningProgress.findMany({
    include: {
      lesson: {
        include: {
          video: true,
        }
      }
    }
  });
  
  console.log('=== Progress entries ===');
  for (const p of progresses) {
    console.log(`Progress ${p.id}: lessonId=${p.lessonId}`);
    console.log(`  lesson: id=${p.lesson.id}, title="${p.lesson.title}", videoId=${p.lesson.videoId}`);
    console.log(`  video:`, p.lesson.video);
  }
  
  // Test 2: Get lesson directly with video
  console.log('\n=== Direct lesson query ===');
  const lessons = await prisma.lesson.findMany({
    include: { video: true }
  });
  
  for (const l of lessons) {
    console.log(`Lesson ${l.id}: videoId=${l.videoId}, video=`, l.video);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
