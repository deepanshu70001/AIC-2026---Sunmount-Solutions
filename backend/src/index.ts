import express from 'express';
import cors from 'cors';
import prisma from './prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = 'super_secret_inventory_key';

console.log('--- STARTING BACKEND SERVER ---');
console.log(`Port: ${PORT}`);


app.use(cors());
app.use(express.json());

import chatRouter from './chat';
app.use('/api/chat', chatRouter);

// ------------------------------
// Auth Middleware
// ------------------------------
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

// ------------------------------
// Auth Endpoints
// ------------------------------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, role: user.role, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ------------------------------
// RBAC Middleware & User Management
// ------------------------------
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'SYSTEM_ADMIN') {
    return res.status(403).json({ error: 'Restricted to SYSTEM_ADMIN' });
  }
  next();
};

const requireRoles = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !req.user.role) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'SYSTEM_ADMIN') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Restricted to [${roles.join(', ')}]` });
    }
    next();
  };
};

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({ 
    select: { id: true, username: true, role: true, created_at: true } 
  });
  res.json(users);
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password_hash, role }
    });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    res.status(400).json({ error: 'Could not create user (Username taken?)' });
  }
});

app.delete('/api/users/:id', authenticate, requireAdmin, async (req: any, res: any) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.put('/api/users/:id/role', authenticate, requireAdmin, async (req: any, res: any) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });
  
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role }
  });
  res.json({ id: user.id, username: user.username, role: user.role });
});

// ------------------------------
// Product Endpoints
// ------------------------------
app.get('/api/products', authenticate, requireRoles(['INVENTORY_MANAGER']), async (req: any, res: any) => {
  const products = await prisma.product.findMany({ orderBy: { last_updated: 'desc' } });
  res.json(products);
});

app.post('/api/products', authenticate, requireRoles(['INVENTORY_MANAGER']), async (req: any, res: any) => {
  const data = req.body;
  const product = await prisma.product.upsert({
    where: { product_code: data.product_code },
    update: { ...data },
    create: { ...data },
  });
  res.json(product);
});

app.delete('/api/products/:id', authenticate, requireRoles(['INVENTORY_MANAGER']), async (req: any, res: any) => {
  await prisma.product.delete({ where: { product_code: req.params.id } });
  res.json({ success: true });
});

// ------------------------------
// Order Endpoints
// ------------------------------
app.get('/api/orders', authenticate, async (req: any, res: any) => {
  const { type } = req.query; // 'SALE' or 'PURCHASE'
  
  if (type === 'SALE' && !['SYSTEM_ADMIN', 'SALES_EXECUTIVE', 'LOGISTICS_COORDINATOR'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sales access restricted' });
  }
  if (type === 'PURCHASE' && !['SYSTEM_ADMIN', 'PROCUREMENT_OFFICER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Purchasing access restricted' });
  }

  const filter = type ? { type: String(type) } : {};
  const orders = await prisma.order.findMany({ where: filter, orderBy: { date: 'desc' } });
  
  // parse product JSON strings back into objects
  const parsed = orders.map(o => ({ ...o, products: JSON.parse(o.products || '[]') }));
  res.json(parsed);
});

app.post('/api/orders', authenticate, async (req: any, res: any) => {
  const data = req.body;
  
  if (data.type === 'SALE' && !['SYSTEM_ADMIN', 'SALES_EXECUTIVE'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Sales Executives can create sales orders' });
  }
  if (data.type === 'PURCHASE' && !['SYSTEM_ADMIN', 'PROCUREMENT_OFFICER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Procurement Officers can create purchase orders' });
  }

  // expects data.products to be an array of { product_code, quantity, price }
  const productsStr = JSON.stringify(data.products || []);
  
  // Handle Inventory decrement for Sales and increment for purchases (simplified)
  if (data.status === 'DISPATCH' && data.type === 'SALE') {
    for (const p of data.products) {
      await prisma.product.update({
        where: { product_code: p.product_code },
        data: { quantity: { decrement: p.quantity } }
      });
    }
  } else if (data.status === 'COMPLETED' && data.type === 'PURCHASE') {
    for (const p of data.products) {
      await prisma.product.update({
        where: { product_code: p.product_code },
        data: { quantity: { increment: p.quantity } }
      });
    }
  }

  const order = await prisma.order.create({
    data: {
      type: data.type,
      customer_supplier_id: data.customer_supplier_id,
      status: data.status,
      notes: data.notes,
      products: productsStr
    }
  });

  res.json({ ...order, products: JSON.parse(order.products) });
});

app.put('/api/orders/:id', authenticate, async (req: any, res: any) => {
  const data = req.body;
  
  const existingOrder = await prisma.order.findUnique({ where: { order_id: req.params.id } });
  if (!existingOrder) return res.status(404).json({ error: 'Order not found' });
  
  if (existingOrder.type === 'SALE') {
    if (data.status === 'DISPATCH' && !['SYSTEM_ADMIN', 'LOGISTICS_COORDINATOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Logistics can dispatch' });
    }
    if (data.status !== 'DISPATCH' && !['SYSTEM_ADMIN', 'SALES_EXECUTIVE'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Sales can modify quotations' });
    }
  } else if (existingOrder.type === 'PURCHASE' && !['SYSTEM_ADMIN', 'PROCUREMENT_OFFICER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Purchasing can modify purchase orders' });
  }
  const productsStr = data.products ? JSON.stringify(data.products) : undefined;
  
  // Here we would handle deltas in inventory if status changes to DISPATCH, but keeping it simple for hackathon
  const order = await prisma.order.update({
    where: { order_id: req.params.id },
    data: {
      status: data.status,
      notes: data.notes,
      ...(productsStr && { products: productsStr }),
    }
  });
  res.json({ ...order, products: JSON.parse(order.products) });
});

// ------------------------------
// Manufacturing Endpoints
// ------------------------------
app.get('/api/manufacturing', authenticate, requireRoles(['PRODUCTION_TECHNICIAN']), async (req: any, res: any) => {
  const records = await prisma.manufacturing.findMany({ orderBy: { start_date: 'desc' } });
  const parsed = records.map(r => ({
    ...r,
    raw_materials: JSON.parse(r.raw_materials || '[]'),
    output: JSON.parse(r.output || '[]')
  }));
  res.json(parsed);
});

app.post('/api/manufacturing', authenticate, requireRoles(['PRODUCTION_TECHNICIAN']), async (req: any, res: any) => {
  const data = req.body;
  const rawStr = JSON.stringify(data.raw_materials || []);
  const outStr = JSON.stringify(data.output || []);

  // Deduct raw materials on WIP start
  for (const rm of data.raw_materials) {
    await prisma.product.update({
      where: { product_code: rm.product_code },
      data: { quantity: { decrement: rm.quantity } }
    });
  }

  const mfg = await prisma.manufacturing.create({
    data: {
      batch_number: data.batch_number,
      raw_materials: rawStr,
      output: outStr,
      status: 'WIP'
    }
  });
  
  res.json({ ...mfg, raw_materials: JSON.parse(mfg.raw_materials), output: JSON.parse(mfg.output) });
});

app.put('/api/manufacturing/:id', authenticate, requireRoles(['PRODUCTION_TECHNICIAN']), async (req: any, res: any) => {
  const data = req.body;
  const status = data.status;

  if (status === 'COMPLETED') {
    // We lookup the output to add to stock
    // Just handling simple case assuming data.output is passed again
    for (const out of data.output) {
      await prisma.product.update({
        where: { product_code: out.product_code },
        data: { quantity: { increment: out.quantity } }
      });
    }
  }

  const mfg = await prisma.manufacturing.update({
    where: { batch_number: req.params.id },
    data: {
      status: status,
      ...(status === 'COMPLETED' && { end_date: new Date() })
    }
  });
  
  res.json({ ...mfg, raw_materials: JSON.parse(mfg.raw_materials), output: JSON.parse(mfg.output) });
});

// ------------------------------
// Dashboard Stats Endpoint
// ------------------------------
app.get('/api/dashboard/stats', authenticate, async (req: any, res: any) => {
  try {
    const products = await prisma.product.findMany();
    const totalValue = products.reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0);
    const lowStockCount = products.filter((p: any) => p.quantity < 15).length;
    const criticalCount = products.filter((p: any) => p.quantity < 5).length;

    const pendingOrders = await prisma.order.count({ where: { status: { not: 'DISPATCH' } } });
    const activeBatches = await prisma.manufacturing.count({ where: { status: 'WIP' } });

    // Recent activity from orders and manufacturing
    const recentOrders = await prisma.order.findMany({ orderBy: { date: 'desc' }, take: 5 });
    const recentMfg = await prisma.manufacturing.findMany({ orderBy: { start_date: 'desc' }, take: 3 });

    const activity = [
      ...recentOrders.map((o: any) => ({
        type: o.type === 'SALE' ? 'sale' : 'purchase',
        description: `${o.type} order ${o.status.toLowerCase()} — ${o.customer_supplier_id || 'Unknown'}`,
        status: o.status,
        date: o.date,
        id: o.order_id
      })),
      ...recentMfg.map((m: any) => ({
        type: 'manufacturing',
        description: `Batch ${m.batch_number} — ${m.status}`,
        status: m.status,
        date: m.start_date,
        id: m.batch_number
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

    res.json({
      totalProducts: products.length,
      totalInventoryValue: totalValue,
      lowStockCount,
      criticalCount,
      pendingOrders,
      activeBatches,
      activity
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

// ------------------------------
// CSV Export Endpoint
// ------------------------------
app.get('/api/export/orders', authenticate, async (req: any, res: any) => {
  const { type } = req.query;
  const filter = type ? { type: String(type) } : {};
  const orders = await prisma.order.findMany({ where: filter, orderBy: { date: 'desc' } });

  const header = 'Order ID,Type,Customer/Supplier,Status,Date,Products,Notes\n';
  const rows = orders.map((o: any) => {
    const prods = JSON.parse(o.products || '[]');
    const prodSummary = prods.map((p: any) => `${p.product_code}x${p.quantity}`).join('; ');
    const total = prods.reduce((s: number, p: any) => s + (p.price * p.quantity), 0);
    return `"${o.order_id}","${o.type}","${o.customer_supplier_id || ''}","${o.status}","${new Date(o.date).toLocaleDateString()}","${prodSummary} (₹${total.toFixed(2)})","${(o.notes || '').replace(/"/g, '""')}"`;
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=orders_${type || 'all'}_${Date.now()}.csv`);
  res.send(header + rows);
});

app.get('/api/export/manufacturing', authenticate, async (req: any, res: any) => {
  const records = await prisma.manufacturing.findMany({ orderBy: { start_date: 'desc' } });
  const header = 'Batch Number,Status,Start Date,End Date,Raw Materials,Output\n';
  const rows = records.map((m: any) => {
    const raw = JSON.parse(m.raw_materials || '[]').map((r: any) => `${r.product_code}x${r.quantity}`).join('; ');
    const out = JSON.parse(m.output || '[]').map((o: any) => `${o.product_code}x${o.quantity}`).join('; ');
    return `"${m.batch_number}","${m.status}","${new Date(m.start_date).toLocaleDateString()}","${m.end_date ? new Date(m.end_date).toLocaleDateString() : ''}","${raw}","${out}"`;
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=manufacturing_${Date.now()}.csv`);
  res.send(header + rows);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend APIs running on port ${PORT}`);
});
