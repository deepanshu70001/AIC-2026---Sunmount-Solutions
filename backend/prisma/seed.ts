import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing users...');
  await prisma.user.deleteMany();

  const password_hash = await bcrypt.hash('password123', 10);

  console.log('Seeding default SYSTEM_ADMIN...');
  await prisma.user.create({
    data: {
      username: 'admin',
      password_hash,
      role: 'SYSTEM_ADMIN' // Full access
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
