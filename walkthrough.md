# Inventory Pro Walkthrough

## 1) Startup Checklist

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run seed
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## 2) Demo Credentials

- `admin / password123`
- `sales_rep / test123`
- `stock_mgr / test123`
- `buyer / test123`
- `factory / test123`
- `dispatch / test123`

## 3) Core Hackathon Storyline

### A. Compliance Automation (GST + E-Way Bill 2.0)

1. Login as `sales_rep` and create a quotation in Sales.
2. Move the order to Packing.
3. Login as `dispatch` and open the same order.
4. Use **Compliance Dispatch Console** to fill invoice and transport info.
5. Dispatch order and show auto-generated compliance metadata:
   - E-Way status and number
   - invoice value and GST breakup
   - filing health status

### B. CRDT-Based Distributed Sync

1. Explain stock now uses PN-counters (`P` and `N`) per SKU.
2. Call `POST /api/inventory/crdt/merge` with node snapshots from an offline desktop.
3. Repeat the same request to demonstrate idempotent merge (no double-apply).
4. Open `GET /api/inventory/crdt/summary` to show converged quantity and node replication state.

### C. Real-World Risk Intelligence

1. Open Dashboard and show:
   - stockout prediction
   - delayed purchases
   - reorder actions
2. Open GST control tower section and show:
   - blocked dispatch risk
   - ITC mismatch alerts

## 4) Key API Endpoints

- `GET /api/dashboard/stats`
- `GET /api/insights/risk-summary`
- `GET /api/compliance/summary`
- `GET /api/inventory/crdt/summary`
- `POST /api/inventory/crdt/merge`

## 5) Environment Variables to Highlight

Backend:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `EWAY_BILL_MODE`
- `EWAY_BILL_THRESHOLD_INR`
- `CRDT_NODE_ID`

Frontend:

- `VITE_API_BASE_URL`

## 6) Optional Live Mode Notes

- Keep `EWAY_BILL_MODE=SIMULATED` for stable judging demo.
- Switch to `LIVE` only when valid provider endpoint/token are available.
