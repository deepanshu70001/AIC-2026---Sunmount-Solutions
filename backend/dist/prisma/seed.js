"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Clearing existing users...');
    await prisma.user.deleteMany();
    const password_hash = await bcryptjs_1.default.hash('password123', 10);
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
