import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

// Prisma v7 requires a driver adapter
const adapter = new PrismaBetterSqlite3({
  url: 'file:' + path.resolve(__dirname, '..', 'dev.db')
});

const prisma = new PrismaClient({ adapter });

export default prisma;
