import express from 'express';
import cors from 'cors';
import prisma from './prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import {
  buildComplianceSummary,
  evaluateDispatchCompliance,
  type ComplianceProduct
} from './compliance';
import {
  applyDeltaToStockState,
  materializeStockCounterState,
  mergeNodeSnapshotIntoState,
  normalizeNodeId,
  serializeCounter
} from './crdt';
import { generateOrderPdf, generateInventoryPdf } from './pdf';
import { generateForecasts } from './ml';

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_inventory_key';
const MIN_STOCK_THRESHOLD = 15;
const CRITICAL_STOCK_THRESHOLD = 5;

type OrderType = 'SALE' | 'PURCHASE';
type SalesOrderStatus = 'QUOTATION' | 'PACKING' | 'DISPATCH';
type PurchaseOrderStatus = 'QUOTATION' | 'PAID' | 'UNPAID' | 'COMPLETED';

type OrderLine = {
  product_code: string;
  quantity: number;
  price: number;
  hsn_code?: string;
  gst_rate?: number;
};

type QuantityLine = {
  product_code: string;
  quantity: number;
};

type InventoryChange = {
  product_code: string;
  quantityDelta: number;
};

type CrdtSnapshotRow = {
  product_code: string;
  p: number;
  n: number;
};

const SALES_STATUSES = new Set<SalesOrderStatus>(['QUOTATION', 'PACKING', 'DISPATCH']);
const PURCHASE_STATUSES = new Set<PurchaseOrderStatus>(['QUOTATION', 'PAID', 'UNPAID', 'COMPLETED']);
const CRDT_CLOUD_NODE_ID = normalizeNodeId(process.env.CRDT_CLOUD_NODE_ID || process.env.CRDT_NODE_ID || 'CLOUD-HQ');

const PARTY_DIRECTORY = [
  {
    id: 'CUST-1001',
    type: 'CUSTOMER',
    name: 'Tata Projects Ltd',
    contactPerson: 'Nikhil Sharma',
    phone: '+91-98765-12001',
    paymentTerms: 'Net 30',
    reliabilityScore: 91
  },
  {
    id: 'CUST-1002',
    type: 'CUSTOMER',
    name: 'L&T Engineering',
    contactPerson: 'Pooja Verma',
    phone: '+91-98765-12002',
    paymentTerms: 'Net 21',
    reliabilityScore: 87
  },
  {
    id: 'CUST-1003',
    type: 'CUSTOMER',
    name: 'Mahindra Industrial Works',
    contactPerson: 'Karan Mehta',
    phone: '+91-98765-12003',
    paymentTerms: 'Net 45',
    reliabilityScore: 74
  },
  {
    id: 'SUP-2001',
    type: 'SUPPLIER',
    name: 'Jindal Steel & Power',
    contactPerson: 'Priyanka Joshi',
    phone: '+91-99876-22001',
    paymentTerms: 'Advance 20%, Balance on Delivery',
    reliabilityScore: 82
  },
  {
    id: 'SUP-2002',
    type: 'SUPPLIER',
    name: 'Havells India',
    contactPerson: 'Rahul Menon',
    phone: '+91-99876-22002',
    paymentTerms: 'Net 30',
    reliabilityScore: 88
  },
  {
    id: 'SUP-2003',
    type: 'SUPPLIER',
    name: 'Bharat Raw Materials Co.',
    contactPerson: 'Aditi Singh',
    phone: '+91-99876-22003',
    paymentTerms: 'Net 15',
    reliabilityScore: 63
  }
];

const parseStoredJsonArray = <T>(value: string | null | undefined): T[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseStoredJsonObject = (value: string | null | undefined) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mapOrderForResponse = (order: any) => ({
  ...order,
  products: parseStoredJsonArray<OrderLine>(order.products),
  transport_details: parseStoredJsonObject(order.transport_details),
  compliance_meta: parseStoredJsonObject(order.compliance_meta)
});

const normalizeOrderType = (value: unknown): OrderType => {
  const type = String(value || '').trim().toUpperCase();
  if (type !== 'SALE' && type !== 'PURCHASE') {
    throw new Error('Order type must be SALE or PURCHASE');
  }
  return type;
};

const normalizeOrderStatus = (type: OrderType, value: unknown): SalesOrderStatus | PurchaseOrderStatus => {
  const status = String(value || '').trim().toUpperCase();
  if (type === 'SALE' && SALES_STATUSES.has(status as SalesOrderStatus)) {
    return status as SalesOrderStatus;
  }
  if (type === 'PURCHASE' && PURCHASE_STATUSES.has(status as PurchaseOrderStatus)) {
    return status as PurchaseOrderStatus;
  }
  throw new Error(`Invalid status for ${type} order`);
};

const parseOrderLines = (value: unknown): OrderLine[] => {
  if (!Array.isArray(value) || value.length === 0) throw new Error('At least one product line is required');
  return value.map((raw: any, index: number) => {
    const product_code = String(raw.product_code || '').trim().toUpperCase();
    const quantity = Number(raw.quantity);
    const price = Number(raw.price);
    const hsn_code = raw.hsn_code ? String(raw.hsn_code).trim() : undefined;
    const gst_rate = raw.gst_rate !== undefined ? Number(raw.gst_rate) : undefined;
    if (!product_code) throw new Error(`Missing product code at row ${index + 1}`);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Invalid quantity at row ${index + 1}`);
    if (!Number.isFinite(price) || price < 0) throw new Error(`Invalid price at row ${index + 1}`);
    if (gst_rate !== undefined && (!Number.isFinite(gst_rate) || gst_rate < 0 || gst_rate > 40)) {
      throw new Error(`Invalid GST rate at row ${index + 1}`);
    }
    return { product_code, quantity, price, ...(hsn_code && { hsn_code }), ...(gst_rate !== undefined && { gst_rate }) };
  });
};

const parseQuantityLines = (value: unknown, label: string): QuantityLine[] => {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must contain at least one row`);
  return value.map((raw: any, index: number) => {
    const product_code = String(raw.product_code || '').trim().toUpperCase();
    const quantity = Number(raw.quantity);
    if (!product_code) throw new Error(`Missing ${label} product code at row ${index + 1}`);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Invalid ${label} quantity at row ${index + 1}`);
    return { product_code, quantity };
  });
};

const parseCrdtSnapshotRows = (value: unknown): CrdtSnapshotRow[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('CRDT snapshot payload must contain at least one row');
  }

  const seenCodes = new Set<string>();
  return value.map((raw: any, index: number) => {
    const product_code = String(raw.product_code || raw.productCode || '').trim().toUpperCase();
    const p = Number(raw.p);
    const n = Number(raw.n);

    if (!product_code) throw new Error(`Missing product code in CRDT row ${index + 1}`);
    if (!Number.isInteger(p) || p < 0) throw new Error(`Invalid CRDT positive counter at row ${index + 1}`);
    if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid CRDT negative counter at row ${index + 1}`);
    if (seenCodes.has(product_code)) {
      throw new Error(`Duplicate product code in CRDT row ${index + 1}: ${product_code}`);
    }
    seenCodes.add(product_code);

    return { product_code, p, n };
  });
};

const aggregateInventoryChanges = (changes: InventoryChange[]): InventoryChange[] => {
  const byProduct = new Map<string, number>();
  for (const change of changes) {
    byProduct.set(change.product_code, (byProduct.get(change.product_code) || 0) + change.quantityDelta);
  }
  return Array.from(byProduct.entries())
    .map(([product_code, quantityDelta]) => ({ product_code, quantityDelta }))
    .filter(change => change.quantityDelta !== 0);
};

const invertInventoryChanges = (changes: InventoryChange[]): InventoryChange[] =>
  changes.map(change => ({ ...change, quantityDelta: -change.quantityDelta }));

const getAppliedOrderInventoryChanges = (
  type: OrderType,
  status: SalesOrderStatus | PurchaseOrderStatus,
  products: OrderLine[]
): InventoryChange[] => {
  if (type === 'SALE' && status === 'DISPATCH') {
    return products.map(product => ({ product_code: product.product_code, quantityDelta: -product.quantity }));
  }
  if (type === 'PURCHASE' && status === 'COMPLETED') {
    return products.map(product => ({ product_code: product.product_code, quantityDelta: product.quantity }));
  }
  return [];
};

const persistProductStockState = async (
  tx: any,
  product: any,
  nextState: any,
  nodeId: string
) => {
  const updateResult = await tx.product.updateMany({
    where: {
      product_code: String(product.product_code),
      quantity: Number(product.quantity || 0),
      crdt_p: String(product.crdt_p || '{}'),
      crdt_n: String(product.crdt_n || '{}')
    },
    data: {
      quantity: nextState.value,
      crdt_p: serializeCounter(nextState.p),
      crdt_n: serializeCounter(nextState.n),
      crdt_last_node: nodeId,
      crdt_last_merged_at: new Date()
    }
  });

  if (updateResult.count !== 1) {
    throw new Error(`Concurrent stock update detected for ${String(product.product_code)}`);
  }
};

const applyInventoryChanges = async (
  tx: any,
  rawChanges: InventoryChange[],
  nodeIdInput: string = CRDT_CLOUD_NODE_ID
) => {
  const changes = aggregateInventoryChanges(rawChanges);
  if (changes.length === 0) return;
  const nodeId = normalizeNodeId(nodeIdInput);

  const productCodes = changes.map(change => change.product_code);
  const products = await tx.product.findMany({
    where: { product_code: { in: productCodes } },
    select: {
      product_code: true,
      quantity: true,
      crdt_p: true,
      crdt_n: true
    }
  });
  const productMap = new Map<string, any>(
    products.map((product: any) => [String(product.product_code), product])
  );

  for (const code of productCodes) {
    if (!productMap.has(code)) throw new Error(`Unknown product code: ${code}`);
  }

  const nextStateByProduct = new Map<string, any>();
  for (const change of changes) {
    const product = productMap.get(change.product_code);
    const currentState = deriveProductStockState(product);
    const nextState = applyDeltaToStockState(currentState, nodeId, change.quantityDelta);

    if (nextState.value < 0) {
      const available = Math.max(currentState.value, Number(product.quantity || 0));
      throw new Error(`Insufficient stock for ${change.product_code}. Available: ${available}`);
    }
    nextStateByProduct.set(change.product_code, nextState);
  }

  for (const change of changes) {
    const product = productMap.get(change.product_code);
    const nextState = nextStateByProduct.get(change.product_code);
    await persistProductStockState(tx, product, nextState, nodeId);
  }
};

const getProductCatalogForOrder = async (tx: any, products: OrderLine[]): Promise<ComplianceProduct[]> => {
  const productCodes = Array.from(new Set(products.map(product => product.product_code)));
  if (productCodes.length === 0) return [];
  return tx.product.findMany({
    where: { product_code: { in: productCodes } },
    select: { product_code: true, name: true, hsn_code: true, gst_rate: true }
  });
};

const deriveProductStockState = (product: any) => {
  const currentState = materializeStockCounterState(product.crdt_p, product.crdt_n);
  const hasCounters = Object.keys(currentState.p).length > 0 || Object.keys(currentState.n).length > 0;
  const quantity = Number(product.quantity || 0);

  if (!hasCounters && quantity > 0) {
    return {
      p: { [CRDT_CLOUD_NODE_ID]: quantity },
      n: {},
      value: quantity,
      bootstrapped: true
    };
  }

  return { ...currentState, bootstrapped: false };
};

const DB_TX_MAX_RETRIES = Math.max(1, Number(process.env.DB_TX_MAX_RETRIES || 3));
const DB_TX_RETRY_BASE_MS = Math.max(10, Number(process.env.DB_TX_RETRY_BASE_MS || 40));

class ConcurrencyConflictError extends Error {
  constructor(message: string = 'Concurrent transaction conflict. Please retry.') {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableTransactionError = (error: any) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (code === 'P2034') return true; // Transaction conflict / deadlock style error.

  const retryableSignals = [
    'write conflict',
    'transaction aborted',
    'transienttransactionerror',
    'unknowntransactioncommitresult',
    'deadlock',
    'concurrent',
    'temporarily unavailable'
  ];
  return retryableSignals.some(signal => message.includes(signal));
};

const runAcidTransaction = async <T>(work: (tx: any) => Promise<T>): Promise<T> => {
  for (let attempt = 1; attempt <= DB_TX_MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx: any) => work(tx));
    } catch (error: any) {
      const retryable = isRetryableTransactionError(error);
      const isLastAttempt = attempt >= DB_TX_MAX_RETRIES;
      if (!retryable || isLastAttempt) {
        if (retryable) {
          throw new ConcurrencyConflictError();
        }
        throw error;
      }
      const backoffMs = DB_TX_RETRY_BASE_MS * attempt;
      await sleep(backoffMs);
    }
  }
  throw new ConcurrencyConflictError();
};

const getRequestErrorStatus = (error: any, fallbackStatus: number = 400) => {
  if (error instanceof ConcurrencyConflictError) return 409;
  const message = String(error?.message || '');
  if (/blocked/i.test(message)) return 409;
  return fallbackStatus;
};

const daysSince = (date: Date) => Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
const riskLevelFromScore = (score: number) => (score >= 85 ? 'LOW' : score >= 70 ? 'MEDIUM' : 'HIGH');

console.log('--- STARTING BACKEND SERVER ---');
console.log(`Port: ${PORT}`);


const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors(
  corsOrigins.length > 0
    ? {
        origin: (origin, callback) => {
          if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error('Not allowed by CORS'));
        }
      }
    : undefined
));
app.use(express.json());

import chatRouter from './chat';
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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

// Mount chat router with authentication
app.use('/api/chat', authenticate, chatRouter);

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
  try {
    const users = await prisma.user.findMany({ 
      select: { id: true, username: true, role: true, created_at: true } 
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' });
  }
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
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
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
// Partner Auto-Fill Endpoint
// ------------------------------
app.get('/api/parties/:id', authenticate, async (req: any, res: any) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const requestedType = String(req.query.type || '').trim().toUpperCase();

  const party = PARTY_DIRECTORY.find(p => {
    if (p.id !== id) return false;
    if (!requestedType) return true;
    return p.type === requestedType;
  });

  if (!party) {
    return res.status(404).json({ error: 'Party not found' });
  }

  const activeOrderCount = await prisma.order.count({
    where: {
      customer_supplier_id: { contains: party.id },
      status: { in: ['QUOTATION', 'PACKING', 'PAID', 'UNPAID'] }
    }
  });

  res.json({
    ...party,
    activeOrderCount,
    riskLevel: riskLevelFromScore(party.reliabilityScore)
  });
});

// ------------------------------
// Product Endpoints
// ------------------------------
app.get('/api/products', authenticate, requireRoles(['INVENTORY_MANAGER', 'PRODUCTION_TECHNICIAN']), async (req: any, res: any) => {
  const products = await prisma.product.findMany({ orderBy: { last_updated: 'desc' } });
  res.json(products);
});

app.post('/api/products', authenticate, requireRoles(['INVENTORY_MANAGER']), async (req: any, res: any) => {
  try {
    const data = req.body || {};
    const normalizedProduct = {
      ...data,
      product_code: String(data.product_code || '').trim().toUpperCase(),
      hsn_code: data.hsn_code ? String(data.hsn_code).trim() : null,
      gst_rate: data.gst_rate !== undefined ? Number(data.gst_rate) : undefined
    };

    if (!normalizedProduct.product_code) {
      throw new Error('Product code is required');
    }
    if (normalizedProduct.gst_rate !== undefined && (!Number.isFinite(normalizedProduct.gst_rate) || normalizedProduct.gst_rate < 0 || normalizedProduct.gst_rate > 40)) {
      throw new Error('GST rate must be between 0 and 40');
    }

    const product = await prisma.product.upsert({
      where: { product_code: normalizedProduct.product_code },
      update: { ...normalizedProduct },
      create: { ...normalizedProduct },
    });
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to save product' });
  }
});

app.delete('/api/products/:id', authenticate, requireRoles(['INVENTORY_MANAGER']), async (req: any, res: any) => {
  try {
    await prisma.product.delete({ where: { product_code: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
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

  res.json(orders.map(mapOrderForResponse));
});

app.post('/api/orders', authenticate, async (req: any, res: any) => {
  try {
    const data = req.body || {};
    const orderType = normalizeOrderType(data.type);
    const role = req.user?.role || '';

    if (orderType === 'SALE' && !['SYSTEM_ADMIN', 'SALES_EXECUTIVE', 'LOGISTICS_COORDINATOR'].includes(role)) {
      return res.status(403).json({ error: 'Only Sales/Logistics users can create sales orders' });
    }
    if (orderType === 'PURCHASE' && !['SYSTEM_ADMIN', 'PROCUREMENT_OFFICER'].includes(role)) {
      return res.status(403).json({ error: 'Only Procurement Officers can create purchase orders' });
    }

    const status = normalizeOrderStatus(orderType, data.status || 'QUOTATION');
    if (orderType === 'SALE' && status === 'DISPATCH' && !['SYSTEM_ADMIN', 'LOGISTICS_COORDINATOR'].includes(role)) {
      return res.status(403).json({ error: 'Only Logistics can dispatch sales orders' });
    }
    if (orderType === 'SALE' && status !== 'DISPATCH' && !['SYSTEM_ADMIN', 'SALES_EXECUTIVE'].includes(role)) {
      return res.status(403).json({ error: 'Only Sales can create quotation/packing sales orders' });
    }

    const products = parseOrderLines(data.products);
    const productsStr = JSON.stringify(products);
    const orderId = randomUUID();
    const invoiceNumber = data.invoice_number ? String(data.invoice_number).trim() : null;
    const transportInput = data.transport_details || data.transportDetails;

    const order = await runAcidTransaction(async (tx: any) => {
      let complianceData: any = {};
      if (orderType === 'SALE' && status === 'DISPATCH') {
        const productCatalog = await getProductCatalogForOrder(tx, products);
        complianceData = await evaluateDispatchCompliance({
          orderId,
          customerSupplierId: data.customer_supplier_id ? String(data.customer_supplier_id).trim() : null,
          invoiceNumber,
          products,
          productCatalog,
          transportDetails: transportInput
        });
      }

      const appliedChanges = getAppliedOrderInventoryChanges(orderType, status, products);
      await applyInventoryChanges(tx, appliedChanges);

      return tx.order.create({
        data: {
          order_id: orderId,
          type: orderType,
          customer_supplier_id: data.customer_supplier_id ? String(data.customer_supplier_id).trim() : null,
          status,
          ...(invoiceNumber && { invoice_number: invoiceNumber }),
          ...(transportInput && status !== 'DISPATCH' && { transport_details: JSON.stringify(transportInput) }),
          ...complianceData,
          notes: data.notes ? String(data.notes).trim() : null,
          products: productsStr
        }
      });
    });

    res.json(mapOrderForResponse(order));
  } catch (error: any) {
    const message = error?.message || 'Failed to create order';
    const statusCode = getRequestErrorStatus(error, 400);
    res.status(statusCode).json({ error: message });
  }
});

app.put('/api/orders/:id', authenticate, async (req: any, res: any) => {
  try {
    const data = req.body || {};
    const role = req.user?.role || '';

    const order = await runAcidTransaction(async (tx: any) => {
      const existingOrder = await tx.order.findUnique({ where: { order_id: req.params.id } });
      if (!existingOrder) throw new Error('Order not found');

      const orderType = normalizeOrderType(existingOrder.type);
      const existingProducts = parseStoredJsonArray<OrderLine>(existingOrder.products);
      const nextProducts = data.products ? parseOrderLines(data.products) : existingProducts;
      const nextStatus = data.status
        ? normalizeOrderStatus(orderType, data.status)
        : normalizeOrderStatus(orderType, existingOrder.status);
      const invoiceNumber = data.invoice_number !== undefined
        ? String(data.invoice_number || '').trim()
        : existingOrder.invoice_number;
      const incomingTransport = data.transport_details || data.transportDetails;

      if (orderType === 'SALE') {
        if (nextStatus === 'DISPATCH' && !['SYSTEM_ADMIN', 'LOGISTICS_COORDINATOR'].includes(role)) {
          throw new Error('Only Logistics can dispatch sales orders');
        }
        if (nextStatus !== 'DISPATCH' && !['SYSTEM_ADMIN', 'SALES_EXECUTIVE'].includes(role)) {
          throw new Error('Only Sales can modify quotation/packing sales orders');
        }
      } else if (!['SYSTEM_ADMIN', 'PROCUREMENT_OFFICER'].includes(role)) {
        throw new Error('Only Procurement can modify purchase orders');
      }

      const oldAppliedChanges = getAppliedOrderInventoryChanges(
        orderType,
        normalizeOrderStatus(orderType, existingOrder.status),
        existingProducts
      );
      const newAppliedChanges = getAppliedOrderInventoryChanges(orderType, nextStatus, nextProducts);
      const netChanges = aggregateInventoryChanges([...newAppliedChanges, ...invertInventoryChanges(oldAppliedChanges)]);

      await applyInventoryChanges(tx, netChanges);

      let complianceData: any = {};
      if (orderType === 'SALE' && nextStatus === 'DISPATCH') {
        const transportFromOrder = parseStoredJsonObject(existingOrder.transport_details);
        const productCatalog = await getProductCatalogForOrder(tx, nextProducts);
        complianceData = await evaluateDispatchCompliance({
          orderId: existingOrder.order_id,
          customerSupplierId: existingOrder.customer_supplier_id,
          invoiceNumber,
          products: nextProducts,
          productCatalog,
          transportDetails: incomingTransport || transportFromOrder
        });
      }

      const updateData: any = {
        status: nextStatus,
        notes: data.notes !== undefined ? String(data.notes || '').trim() : existingOrder.notes,
        products: data.products ? JSON.stringify(nextProducts) : existingOrder.products
      };
      if (data.invoice_number !== undefined) {
        updateData.invoice_number = invoiceNumber || null;
      }
      if (incomingTransport && nextStatus !== 'DISPATCH') {
        updateData.transport_details = JSON.stringify(incomingTransport);
      }
      Object.assign(updateData, complianceData);

      const updateResult = await tx.order.updateMany({
        where: {
          order_id: req.params.id,
          status: existingOrder.status,
          products: existingOrder.products,
          invoice_number: existingOrder.invoice_number,
          transport_details: existingOrder.transport_details,
          notes: existingOrder.notes
        },
        data: updateData
      });

      if (updateResult.count !== 1) {
        throw new Error(`Concurrent order update detected for ${existingOrder.order_id}`);
      }

      const updatedOrder = await tx.order.findUnique({ where: { order_id: req.params.id } });
      if (!updatedOrder) throw new Error('Order not found');
      return updatedOrder;
    });

    res.json(mapOrderForResponse(order));
  } catch (error: any) {
    if (error?.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    const message = error?.message || 'Failed to update order';
    const statusCode = getRequestErrorStatus(error, 400);
    res.status(statusCode).json({ error: message });
  }
});

// ------------------------------
// NEW PDF & ML ROUTES
// ------------------------------

app.get('/api/orders/:id/pdf', authenticate, async (req: any, res: any) => {
  try {
    const order = await prisma.order.findUnique({ where: { order_id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const dbProducts = await prisma.product.findMany();
    const doc = generateOrderPdf(order, dbProducts);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${order.order_id}.pdf`);
    
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.get('/api/ml/forecasts', authenticate, async (req: any, res: any) => {
  try {
    const orders = await prisma.order.findMany();
    const products = await prisma.product.findMany();
    const manufacturing = await prisma.manufacturing.findMany();
    
    const forecasts = generateForecasts(orders, products, manufacturing);
    res.json(forecasts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate ML forecasts' });
  }
});

app.get('/api/inventory/report/pdf', authenticate, async (req: any, res: any) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { product_code: 'asc' } });
    const doc = generateInventoryPdf(products);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Inventory_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate inventory PDF' });
  }
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
  try {
    const data = req.body || {};
    const batchNumber = String(data.batch_number || '').trim().toUpperCase();
    if (!batchNumber) throw new Error('Batch number is required');

    const rawMaterials = parseQuantityLines(data.raw_materials, 'raw_materials');
    const output = parseQuantityLines(data.output, 'output');

    const mfg = await runAcidTransaction(async (tx: any) => {
      const deductions = rawMaterials.map(row => ({ product_code: row.product_code, quantityDelta: -row.quantity }));
      await applyInventoryChanges(tx, deductions);

      return tx.manufacturing.create({
        data: {
          batch_number: batchNumber,
          raw_materials: JSON.stringify(rawMaterials),
          output: JSON.stringify(output),
          status: 'WIP'
        }
      });
    });

    res.json({
      ...mfg,
      raw_materials: parseStoredJsonArray<QuantityLine>(mfg.raw_materials),
      output: parseStoredJsonArray<QuantityLine>(mfg.output)
    });
  } catch (error: any) {
    const statusCode = getRequestErrorStatus(error, 400);
    res.status(statusCode).json({ error: error?.message || 'Failed to create manufacturing batch' });
  }
});

app.put('/api/manufacturing/:id', authenticate, requireRoles(['PRODUCTION_TECHNICIAN']), async (req: any, res: any) => {
  try {
    const data = req.body || {};

    const mfg = await runAcidTransaction(async (tx: any) => {
      const existing = await tx.manufacturing.findUnique({
        where: { batch_number: String(req.params.id || '').trim().toUpperCase() }
      });
      if (!existing) throw new Error('Batch not found');

      const existingStatus = String(existing.status || '').toUpperCase();
      const nextStatus = String(data.status || existingStatus).toUpperCase();
      if (!['WIP', 'COMPLETED'].includes(nextStatus)) throw new Error('Invalid status');
      if (existingStatus === 'COMPLETED' && nextStatus !== 'COMPLETED') {
        throw new Error('Completed batches cannot be reopened');
      }

      const existingOutput = parseStoredJsonArray<QuantityLine>(existing.output);
      const nextOutput = data.output ? parseQuantityLines(data.output, 'output') : existingOutput;

      const oldApplied = existingStatus === 'COMPLETED'
        ? existingOutput.map(row => ({ product_code: row.product_code, quantityDelta: row.quantity }))
        : [];
      const newApplied = nextStatus === 'COMPLETED'
        ? nextOutput.map(row => ({ product_code: row.product_code, quantityDelta: row.quantity }))
        : [];
      const netChanges = aggregateInventoryChanges([...newApplied, ...invertInventoryChanges(oldApplied)]);

      await applyInventoryChanges(tx, netChanges);

      const updateData: any = {
        status: nextStatus,
        ...(data.output && { output: JSON.stringify(nextOutput) }),
        ...(existingStatus !== 'COMPLETED' && nextStatus === 'COMPLETED' && { end_date: new Date() })
      };

      const updateResult = await tx.manufacturing.updateMany({
        where: {
          batch_number: existing.batch_number,
          status: existing.status,
          output: existing.output,
          end_date: existing.end_date
        },
        data: updateData
      });

      if (updateResult.count !== 1) {
        throw new Error(`Concurrent manufacturing update detected for ${existing.batch_number}`);
      }

      const updatedBatch = await tx.manufacturing.findUnique({
        where: { batch_number: existing.batch_number }
      });
      if (!updatedBatch) throw new Error('Batch not found');
      return updatedBatch;
    });

    res.json({
      ...mfg,
      raw_materials: parseStoredJsonArray<QuantityLine>(mfg.raw_materials),
      output: parseStoredJsonArray<QuantityLine>(mfg.output)
    });
  } catch (error: any) {
    if (error?.message === 'Batch not found') {
      return res.status(404).json({ error: error.message });
    }
    const statusCode = getRequestErrorStatus(error, 400);
    res.status(statusCode).json({ error: error?.message || 'Failed to update manufacturing batch' });
  }
});

// ------------------------------
// Dashboard Stats Endpoint
// ------------------------------
app.get('/api/dashboard/stats', authenticate, async (req: any, res: any) => {
  try {
    const products = await prisma.product.findMany();
    const totalValue = products.reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0);
    const lowStockCount = products.filter((p: any) => p.quantity < MIN_STOCK_THRESHOLD).length;
    const criticalCount = products.filter((p: any) => p.quantity < CRITICAL_STOCK_THRESHOLD).length;

    const pendingOrders = await prisma.order.count({
      where: {
        OR: [
          { type: 'SALE', status: { in: ['QUOTATION', 'PACKING'] } },
          { type: 'PURCHASE', status: { in: ['QUOTATION', 'PAID', 'UNPAID'] } }
        ]
      }
    });
    const activeBatches = await prisma.manufacturing.count({ where: { status: 'WIP' } });

    // Recent activity from orders and manufacturing
    const recentOrders = await prisma.order.findMany({ orderBy: { date: 'desc' }, take: 5 });
    const recentMfg = await prisma.manufacturing.findMany({ orderBy: { start_date: 'desc' }, take: 3 });

    const activity = [
      ...recentOrders.map((o: any) => ({
        type: o.type === 'SALE' ? 'sale' : 'purchase',
        description: `${o.type} order ${o.status.toLowerCase()} - ${o.customer_supplier_id || 'Unknown'}`,
        status: o.status,
        date: o.date,
        id: o.order_id
      })),
      ...recentMfg.map((m: any) => ({
        type: 'manufacturing',
        description: `Batch ${m.batch_number} - ${m.status}`,
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
// Compliance Summary Endpoint
// ------------------------------
app.get('/api/compliance/summary', authenticate, async (req: any, res: any) => {
  try {
    const summary = await buildComplianceSummary(prisma);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load compliance summary' });
  }
});

// ------------------------------
// CRDT Synchronization Endpoints
// ------------------------------
app.get('/api/inventory/crdt/summary', authenticate, async (req: any, res: any) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        product_code: true,
        name: true,
        quantity: true,
        crdt_p: true,
        crdt_n: true,
        crdt_last_node: true,
        crdt_last_merged_at: true
      },
      orderBy: { product_code: 'asc' }
    });

    const nodeSet = new Set<string>();
    let driftCount = 0;

    const rows = products.map((product: any) => {
      const state = deriveProductStockState(product);
      Object.keys(state.p).forEach(node => nodeSet.add(node));
      Object.keys(state.n).forEach(node => nodeSet.add(node));

      const persistedQty = Number(product.quantity || 0);
      const drift = persistedQty - state.value;
      if (drift !== 0) driftCount += 1;

      return {
        product_code: product.product_code,
        name: product.name,
        persisted_quantity: persistedQty,
        crdt_quantity: state.value,
        drift,
        p: state.p,
        n: state.n,
        last_node: product.crdt_last_node || null,
        last_merged_at: product.crdt_last_merged_at
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      cloudNodeId: CRDT_CLOUD_NODE_ID,
      productCount: rows.length,
      replicationNodeCount: nodeSet.size,
      replicationNodes: Array.from(nodeSet.values()).sort(),
      convergedCount: rows.length - driftCount,
      driftCount,
      rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load CRDT summary' });
  }
});

app.post(
  '/api/inventory/crdt/merge',
  authenticate,
  requireRoles(['INVENTORY_MANAGER', 'LOGISTICS_COORDINATOR', 'PRODUCTION_TECHNICIAN']),
  async (req: any, res: any) => {
    try {
      const payload = req.body || {};
      const nodeId = normalizeNodeId(payload.node_id || payload.nodeId || req.user?.username || 'REMOTE_NODE');
      const rows = parseCrdtSnapshotRows(payload.rows || payload.states || payload.snapshots);

      const mergeResult = await runAcidTransaction(async (tx: any) => {
        const productCodes = Array.from(new Set(rows.map(row => row.product_code)));
        const products = await tx.product.findMany({
          where: { product_code: { in: productCodes } },
          select: {
            product_code: true,
            quantity: true,
            crdt_p: true,
            crdt_n: true
          }
        });

        const productMap = new Map<string, any>(
          products.map((product: any) => [String(product.product_code), product])
        );

        for (const code of productCodes) {
          if (!productMap.has(code)) {
            throw new Error(`Unknown product code in CRDT merge: ${code}`);
          }
        }

        let updatedProducts = 0;
        let noopProducts = 0;
        let mergedPositive = 0;
        let mergedNegative = 0;
        const details: any[] = [];

        for (const row of rows) {
          const product = productMap.get(row.product_code);
          const currentState = deriveProductStockState(product);
          const mergedState = mergeNodeSnapshotIntoState(currentState, nodeId, { p: row.p, n: row.n });

          if (mergedState.value < 0) {
            throw new Error(`CRDT merge would make stock negative for ${row.product_code}`);
          }

          if (mergedState.changed || currentState.bootstrapped) {
            await persistProductStockState(tx, product, mergedState, nodeId);
            productMap.set(row.product_code, {
              ...product,
              quantity: mergedState.value,
              crdt_p: serializeCounter(mergedState.p),
              crdt_n: serializeCounter(mergedState.n)
            });
            updatedProducts += 1;
          } else {
            noopProducts += 1;
          }

          mergedPositive += mergedState.mergedPositive;
          mergedNegative += mergedState.mergedNegative;
          details.push({
            product_code: row.product_code,
            merged_positive: mergedState.mergedPositive,
            merged_negative: mergedState.mergedNegative,
            quantity: mergedState.value,
            changed: mergedState.changed || currentState.bootstrapped
          });
        }

        return {
          updatedProducts,
          noopProducts,
          mergedPositive,
          mergedNegative,
          netMerged: mergedPositive - mergedNegative,
          details
        };
      });

      res.json({
        generatedAt: new Date().toISOString(),
        mode: 'PN_COUNTER_MAX_MERGE',
        nodeId,
        ...mergeResult
      });
    } catch (error: any) {
      const statusCode = getRequestErrorStatus(error, 400);
      res.status(statusCode).json({ error: error?.message || 'Failed to merge CRDT snapshots' });
    }
  }
);

// ------------------------------
// Risk Insights Endpoint
// ------------------------------
app.get('/api/insights/risk-summary', authenticate, async (req: any, res: any) => {
  try {
    const [products, salePipeline, purchasePipeline, recentDispatchedSales] = await Promise.all([
      prisma.product.findMany({ orderBy: { product_code: 'asc' } }),
      prisma.order.findMany({
        where: { type: 'SALE', status: { in: ['QUOTATION', 'PACKING'] } },
        orderBy: { date: 'asc' }
      }),
      prisma.order.findMany({
        where: { type: 'PURCHASE', status: { in: ['QUOTATION', 'PAID', 'UNPAID'] } },
        orderBy: { date: 'asc' }
      }),
      prisma.order.findMany({
        where: {
          type: 'SALE',
          status: 'DISPATCH',
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    const projectedStock = new Map(products.map((product: any) => [product.product_code, product.quantity]));
    const atRiskOrders: any[] = [];

    for (const order of salePipeline) {
      const orderProducts = parseStoredJsonArray<OrderLine>(order.products);
      const shortages: any[] = [];

      for (const line of orderProducts) {
        const currentQty = projectedStock.get(line.product_code) ?? 0;
        const projectedAfterCommit = currentQty - line.quantity;
        projectedStock.set(line.product_code, projectedAfterCommit);

        if (projectedAfterCommit < 0) {
          shortages.push({
            product_code: line.product_code,
            required: line.quantity,
            projected_after_commit: projectedAfterCommit
          });
        }
      }

      if (shortages.length > 0) {
        atRiskOrders.push({
          order_id: order.order_id,
          customer_supplier_id: order.customer_supplier_id || 'Unknown',
          ageDays: daysSince(order.date),
          shortageCount: shortages.length,
          shortages
        });
      }
    }

    const demandByProduct = new Map<string, number>();
    for (const order of recentDispatchedSales) {
      const orderProducts = parseStoredJsonArray<OrderLine>(order.products);
      for (const line of orderProducts) {
        demandByProduct.set(line.product_code, (demandByProduct.get(line.product_code) || 0) + line.quantity);
      }
    }

    const reorderRecommendations = products
      .map((product: any) => {
        const projectedQty = projectedStock.get(product.product_code) ?? product.quantity;
        const monthlyDemand = demandByProduct.get(product.product_code) || 0;
        const avgDailyDemand = monthlyDemand / 30;
        const daysOfCover = avgDailyDemand > 0 ? projectedQty / avgDailyDemand : 999;
        const demandBuffer = Math.ceil(avgDailyDemand * 7);
        const recommendedQty = Math.max(MIN_STOCK_THRESHOLD - projectedQty, 0) + demandBuffer;

        if (recommendedQty <= 0 && projectedQty >= MIN_STOCK_THRESHOLD && daysOfCover > 10) {
          return null;
        }

        return {
          product_code: product.product_code,
          name: product.name,
          currentQty: product.quantity,
          projectedQty,
          avgDailyDemand: Number(avgDailyDemand.toFixed(2)),
          daysOfCover: Number(daysOfCover.toFixed(1)),
          recommendedQty,
          severity:
            projectedQty < CRITICAL_STOCK_THRESHOLD || daysOfCover <= 3
              ? 'HIGH'
              : projectedQty < MIN_STOCK_THRESHOLD || daysOfCover <= 7
                ? 'MEDIUM'
                : 'LOW'
        };
      })
      .filter((item: any) => Boolean(item))
      .sort((a: any, b: any) => a.projectedQty - b.projectedQty || b.recommendedQty - a.recommendedQty)
      .slice(0, 8);

    const delayedPurchases = purchasePipeline
      .map((order: any) => ({
        order_id: order.order_id,
        supplier: order.customer_supplier_id || 'Unknown',
        status: order.status,
        ageDays: daysSince(order.date),
        severity:
          order.status === 'PAID' && daysSince(order.date) > 7
            ? 'HIGH'
            : daysSince(order.date) > 4
              ? 'MEDIUM'
              : 'LOW'
      }))
      .filter((order: any) => (order.status === 'PAID' && order.ageDays > 3) || (order.status === 'UNPAID' && order.ageDays > 5))
      .sort((a: any, b: any) => b.ageDays - a.ageDays)
      .slice(0, 6);

    res.json({
      generatedAt: new Date().toISOString(),
      stockoutRiskCount: atRiskOrders.length,
      delayedPurchaseCount: delayedPurchases.length,
      reorderRecommendationCount: reorderRecommendations.length,
      atRiskOrders: atRiskOrders.slice(0, 6),
      reorderRecommendations,
      delayedPurchases
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load risk insights' });
  }
});

// ------------------------------
// CSV Export Endpoint
// ------------------------------
app.get('/api/export/orders', authenticate, async (req: any, res: any) => {
  const { type } = req.query;
  const filter = type ? { type: String(type) } : {};
  const orders = await prisma.order.findMany({ where: filter, orderBy: { date: 'desc' } });

  const header = 'Order ID,Type,Customer/Supplier,Status,Invoice Number,E-Way Bill Number,E-Way Status,Date,Products,Notes\n';
  const rows = orders.map((o: any) => {
    const prods = JSON.parse(o.products || '[]');
    const prodSummary = prods.map((p: any) => `${p.product_code}x${p.quantity}`).join('; ');
    const total = prods.reduce((s: number, p: any) => s + (p.price * p.quantity), 0);
    return `"${o.order_id}","${o.type}","${o.customer_supplier_id || ''}","${o.status}","${o.invoice_number || ''}","${o.eway_bill_number || ''}","${o.eway_bill_status || ''}","${new Date(o.date).toLocaleDateString()}","${prodSummary} (Rs. ${total.toFixed(2)})","${(o.notes || '').replace(/"/g, '""')}"`;
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

// Start server only outside Vercel serverless runtime
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend APIs running on port ${PORT}`);
  });
}

export default app;



