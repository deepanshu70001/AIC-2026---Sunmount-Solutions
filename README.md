# Inventory Pro

Inventory Pro is a full-stack inventory management platform for SMEs handling sales, purchases, manufacturing, and dispatch workflows.

## What Makes This Hackathon Build Stand Out

- Automated GST and E-Way Bill 2.0 dispatch compliance engine
- Distributed stock synchronization using PN-Counter CRDT merges
- Predictive inventory risk dashboard (stockout, delayed purchase, reorder suggestions)
- Dynamic ITC reconciliation risk indicators for purchase-side compliance
- Role-based workflow controls for sales, procurement, production, logistics, and admin
- Deployment-friendly architecture for MongoDB + Vercel + Render

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Database: MongoDB via Prisma
- Auth: JWT + bcrypt
- AI Assistant: Groq API (optional)

## Core Workflows

- Sales: `QUOTATION -> PACKING -> DISPATCH`
- Purchase: `QUOTATION -> PAID/UNPAID -> COMPLETED`
- Manufacturing: `WIP -> COMPLETED`
- Inventory updates are ACID-safe and status-aware, including concurrent user retries

## ACID Concurrency Controls

- Multi-step inventory/order/manufacturing writes run inside database transactions
- Optimistic compare-and-swap guards prevent lost updates during concurrent edits
- Automatic retry with backoff handles transient write conflicts
- If retries are exhausted, the API returns `409 Conflict` so clients can safely retry

## GST and E-Way Bill Compliance Engine

When a sales order moves to `DISPATCH`, the backend can:

1. Read customer profile, order lines, HSN/SAC, and GST rates
2. Calculate taxable value, GST value, and invoice value
3. Validate transport details (vehicle, transporter, distance, mode)
4. Enforce threshold-based E-Way generation (`EWAY_BILL_THRESHOLD_INR`)
5. Generate E-Way Bill in:
   - `SIMULATED` mode for demo/hackathon reliability
   - `LIVE` mode via external API when credentials are configured
6. Block dispatch if compliance profile indicates filing risk/block state

The dashboard also surfaces:

- Filing health summary
- E-Way generation coverage and pending requirements
- ITC mismatch and discrepancy alerts

## Distributed Synchronization via CRDTs

Inventory stock is represented with product-level PN-counters (`P` and `N`) so concurrent offline updates can merge without lock contention.

- `P` tracks cumulative increments (restocks, production outputs)
- `N` tracks cumulative decrements (sales dispatches, material consumption)
- Effective stock: `sum(P) - sum(N)`

Merge semantics:

1. Each node keeps monotonic counters for each SKU (`p`, `n`)
2. On reconnection, node snapshots are merged via `max(local, incoming)` per counter
3. Merge is commutative, associative, and idempotent
4. Retries are safe and eventually converge to identical state

CRDT APIs:

- `GET /api/inventory/crdt/summary` for observability and drift checks
- `POST /api/inventory/crdt/merge` for offline node replay using PN-counter snapshots

Example merge payload:

```json
{
  "node_id": "WAREHOUSE-DESKTOP-01",
  "rows": [
    { "product_code": "STL-ROD-10", "p": 140, "n": 25 },
    { "product_code": "COP-WR-2.5", "p": 80, "n": 18 }
  ]
}
```

## Project Structure

```text
.
|- backend
|  |- api/index.ts
|  |- prisma/schema.prisma
|  |- src/index.ts
|  |- src/compliance.ts
|  |- seed.js
|  |- vercel.json
|- frontend
|  |- src/config/api.ts
|  |- src/pages/*
|- render.yaml
```

## Local Setup

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run seed
npm run dev
```

Backend runs at `http://localhost:3001`.

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Environment Variables

### Backend (`backend/.env`)

- `DATABASE_URL` MongoDB Atlas connection string
- `JWT_SECRET` JWT signing secret
- `GROQ_API_KEY` optional, required only for AI chat
- `CORS_ORIGINS` comma-separated frontend origins
- `PORT` default `3001`

Compliance-specific variables:

- `EWAY_BILL_THRESHOLD_INR` default `50000`
- `EWAY_BILL_MODE` `SIMULATED` or `LIVE`
- `EWAY_BILL_API_URL` required for live mode
- `EWAY_BILL_AUTH_TOKEN` required for live mode
- `EWAY_TRANSPORT_STRICT` `true` or `false`
- `COMPLIANCE_BLOCKED_PARTIES` comma-separated party IDs

CRDT sync variable:

- `CRDT_NODE_ID` identity of this server node (default `CLOUD-HQ`)

Transaction retry variables:

- `DB_TX_MAX_RETRIES` max retries for transient transaction conflicts (default `3`)
- `DB_TX_RETRY_BASE_MS` linear backoff base in milliseconds (default `40`)

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL=http://localhost:3001`

## Demo Credentials

- `admin / password123` (SYSTEM_ADMIN)
- `sales_rep / test123`
- `stock_mgr / test123`
- `buyer / test123`
- `factory / test123`
- `dispatch / test123`

## Deployment

## Render (recommended split: API + static web)

`render.yaml` already includes:

- `inventory-pro-api` (Node backend)
- `inventory-pro-web` (static frontend)

Set required environment variables in Render dashboard:

- API service: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` (+ optional Groq/compliance live vars)
- Web service: `VITE_API_BASE_URL` pointing to API URL

## Vercel

### Backend on Vercel

Deploy `backend/` as a Vercel project.

- Entry: `backend/api/index.ts`
- Config: `backend/vercel.json`

Set backend env vars in Vercel:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- Optional: `GROQ_API_KEY`, and live compliance vars

### Frontend on Vercel

Deploy `frontend/` as a separate Vercel project.

Set:

- `VITE_API_BASE_URL=<your_backend_base_url>`

## Build Checks

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

## Notes

- This codebase is fully migrated to MongoDB provider in Prisma.
- API calls in frontend are environment-driven for deployment portability.
- The compliance engine is safe to demo in `SIMULATED` mode without external GSTN credentials.
