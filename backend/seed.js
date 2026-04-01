// Seed script using Prisma v7 driver adapter
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const adapter = new PrismaBetterSqlite3({
  url: 'file:' + path.resolve(__dirname, 'dev.db')
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Clear all tables ──
  console.log('Clearing existing data...');
  await prisma.manufacturing.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // ── Users ──
  console.log('Seeding users...');
  const hash = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: { username: 'admin', password_hash: hash, role: 'SYSTEM_ADMIN' }
  });

  const demoUsers = [
    { username: 'sales_rep', role: 'SALES_EXECUTIVE' },
    { username: 'stock_mgr', role: 'INVENTORY_MANAGER' },
    { username: 'buyer', role: 'PROCUREMENT_OFFICER' },
    { username: 'factory', role: 'PRODUCTION_TECHNICIAN' },
    { username: 'dispatch', role: 'LOGISTICS_COORDINATOR' },
  ];

  for (const u of demoUsers) {
    const h = await bcrypt.hash('test123', 10);
    await prisma.user.create({ data: { username: u.username, password_hash: h, role: u.role } });
  }

  // ── Products (Indian industrial goods with ₹ pricing) ──
  console.log('Seeding products...');
  const products = [
    { product_code: 'STL-ROD-10', name: 'Steel Rod 10mm',      description: 'Hot-rolled mild steel rod, 10mm diameter, 6m length', weight: 12.5, price: 850.00,   quantity: 120 },
    { product_code: 'COP-WR-2.5', name: 'Copper Wire 2.5mm',   description: 'Electrolytic grade copper wire, 2.5mm, 100m coil',    weight: 8.0,  price: 4200.00,  quantity: 45 },
    { product_code: 'PVC-P-4IN',  name: 'PVC Pipe 4 inch',     description: 'Schedule 40 PVC pressure pipe, 4 inch, 3m length',    weight: 3.2,  price: 320.00,   quantity: 200 },
    { product_code: 'IND-BLT-M8', name: 'Industrial Bolt M8',  description: 'Grade 8.8 hex bolt M8x50mm, zinc plated',             weight: 0.05, price: 12.50,    quantity: 5000 },
    { product_code: 'RBR-GSK-50', name: 'Rubber Gasket 50mm',  description: 'Nitrile rubber gasket, 50mm ID, 3mm thick',            weight: 0.02, price: 35.00,    quantity: 8 },
    { product_code: 'ALM-SHT-3',  name: 'Aluminium Sheet 3mm', description: 'AA6061-T6 aluminium sheet, 3mm, 1.2m x 2.4m',          weight: 23.0, price: 6500.00,  quantity: 3 },
    { product_code: 'BRG-6205',   name: 'Ball Bearing 6205',   description: 'Deep groove ball bearing 6205-2RS, 25x52x15mm',        weight: 0.13, price: 275.00,   quantity: 12 },
    { product_code: 'GRS-EP2',    name: 'EP2 Grease 500g',     description: 'Lithium complex EP2 multi-purpose grease, 500g tub',   weight: 0.55, price: 180.00,   quantity: 85 },
    { product_code: 'WLD-ROD-E6', name: 'Welding Rod E6013',   description: 'Mild steel welding electrode E6013, 3.15mm, 5kg pack', weight: 5.0,  price: 420.00,   quantity: 35 },
    { product_code: 'SS-PIPE-2',  name: 'SS Pipe 2 inch',      description: 'SS304 seamless pipe, 2 inch, schedule 10, 6m length',  weight: 15.0, price: 3800.00,  quantity: 18 },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  // ── Demo Orders ──
  console.log('Seeding demo orders...');

  // Sales order — Quotation stage
  await prisma.order.create({
    data: {
      type: 'SALE',
      customer_supplier_id: 'Tata Projects Ltd',
      status: 'QUOTATION',
      notes: 'Urgent requirement for construction site',
      products: JSON.stringify([
        { product_code: 'STL-ROD-10', quantity: 50, price: 850.00 },
        { product_code: 'IND-BLT-M8', quantity: 500, price: 12.50 },
      ])
    }
  });

  // Sales order — Dispatched
  await prisma.order.create({
    data: {
      type: 'SALE',
      customer_supplier_id: 'L&T Engineering',
      status: 'DISPATCH',
      notes: 'Monthly supply contract',
      products: JSON.stringify([
        { product_code: 'PVC-P-4IN', quantity: 30, price: 320.00 },
        { product_code: 'WLD-ROD-E6', quantity: 10, price: 420.00 },
      ])
    }
  });

  // Purchase order — Paid, awaiting delivery
  await prisma.order.create({
    data: {
      type: 'PURCHASE',
      customer_supplier_id: 'Jindal Steel & Power',
      status: 'PAID',
      notes: 'Quarterly restock — steel and aluminium',
      products: JSON.stringify([
        { product_code: 'STL-ROD-10', quantity: 200, price: 780.00 },
        { product_code: 'ALM-SHT-3', quantity: 20, price: 6100.00 },
      ])
    }
  });

  // Purchase order — Completed
  await prisma.order.create({
    data: {
      type: 'PURCHASE',
      customer_supplier_id: 'Havells India',
      status: 'COMPLETED',
      notes: 'Copper wire restocking',
      products: JSON.stringify([
        { product_code: 'COP-WR-2.5', quantity: 100, price: 3950.00 },
      ])
    }
  });

  // ── Demo Manufacturing Batch ──
  console.log('Seeding manufacturing batch...');
  await prisma.manufacturing.create({
    data: {
      batch_number: 'BATCH-2026-001',
      status: 'WIP',
      raw_materials: JSON.stringify([
        { product_code: 'STL-ROD-10', quantity: 20 },
        { product_code: 'COP-WR-2.5', quantity: 5 },
      ]),
      output: JSON.stringify([
        { product_code: 'SS-PIPE-2', quantity: 10 },
      ])
    }
  });

  // ── Summary ──
  const users = await prisma.user.findMany({ select: { username: true, role: true } });
  const productCount = await prisma.product.count();
  const orderCount = await prisma.order.count();
  const mfgCount = await prisma.manufacturing.count();

  console.log('\n═══ Seed Summary ═══');
  console.log(`  Users:          ${users.length}`);
  users.forEach(u => console.log(`    ${u.username.padEnd(14)} ${u.role}`));
  console.log(`  Products:       ${productCount}`);
  console.log(`  Orders:         ${orderCount}`);
  console.log(`  Manufacturing:  ${mfgCount}`);
  console.log('\nDatabase seeded successfully!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
