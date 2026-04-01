# Hackathon Audit & Implementation Plan

## SRS Compliance Scorecard

### § 2.1 Inventory Management

| Requirement | Status | Details |
|---|---|---|
| Products schema (code, name, desc, weight, price ₹, qty, last_updated) | ✅ DONE | Prisma schema matches exactly |
| Sales Dispatch → deduct quantity | ✅ DONE | Backend handles in POST /api/orders |
| Purchase Completion → add quantity | ✅ DONE | Backend handles in POST /api/orders |
| WIP Start → deduct raw materials | ✅ DONE | Backend handles in POST /api/manufacturing |
| WIP Completion → add output | ✅ DONE | Backend handles in PUT /api/manufacturing/:id |
| **InventoryPage fetches REAL data from API** | ❌ **CRITICAL** | **Uses hardcoded MOCK_PRODUCTS array — never calls the backend** |
| Add/Edit/Delete products via UI | ❌ MISSING | Buttons exist but are non-functional |

### § 2.2 Order Processing

| Requirement | Status | Details |
|---|---|---|
| Sales: Unlimited products per order | ✅ DONE | Dynamic "+ Add Item" rows |
| Sales: Quotation → Packing → Dispatch flow | ✅ DONE | Status transitions with RBAC |
| Sales: Customer auto-fill on ID entry | ❌ MISSING | No customer/supplier lookup table |
| Purchase Orders page | ❌ **CRITICAL** | Only a StubPage placeholder |
| Purchase: Quotation Received → Paid/Unpaid → Completion | ❌ MISSING | No workflow |

### § 2.3 Manufacturing (WIP)

| Requirement | Status | Details |
|---|---|---|
| Backend API (batch tracking, raw materials, output) | ✅ DONE | Full CRUD with inventory adjustments |
| Frontend Manufacturing page | ❌ **CRITICAL** | Only a StubPage placeholder |

### § 2.4 Order History

| Requirement | Status | Details |
|---|---|---|
| Filters for purchases, sales, manufacturing | ❌ **CRITICAL** | No history/reports page |
| Export to CSV/PDF | ❌ MISSING | Not implemented |

### § 3 UI Requirements

| Requirement | Status | Details |
|---|---|---|
| Dashboard summary cards | ⚠️ PARTIAL | **All values are hardcoded** (₹1,284,590, 14 items, etc.) — not from API |
| Sidebar navigation | ✅ DONE | Role-based visibility |
| Master/Detail layout | ✅ DONE | Sales + Inventory pages |
| Dynamic forms with unlimited rows | ✅ DONE | Sales page |
| Search and filter in list panel | ✅ DONE | Inventory page |
| ₹ currency format with 2 decimals | ✅ DONE | Consistent throughout |
| Color-coded status tags | ✅ DONE | Blue/Orange/Green |
| Clean modern design | ✅ DONE | Material 3 design system |

### § 4 Functional Requirements

| Requirement | Status |
|---|---|
| FR21: Unlimited products per order | ✅ DONE |
| FR22: ₹ INR format with 2 decimals | ✅ DONE |
| FR23: History filters (purchase/sale/manufacturing) | ❌ MISSING |
| FR24: Desktop app syncs with cloud backend | ⚠️ N/A (web only currently) |

### § 6 Security

| Requirement | Status | Details |
|---|---|---|
| Single login / shared credentials | ✅ EXCEEDED | Has full RBAC (6 professional roles) — **better than SRS requirement** |
| HTTPS | ⚠️ DEV | localhost only — cloud deployment would handle this |

---

## Critical Gap Summary

> [!CAUTION]
> These 4 items would cause **immediate point deductions** at a hackathon demo because they're core SRS requirements with visible failures:

1. **Inventory page uses MOCK data** — judges will immediately notice the product list never changes
2. **Dashboard KPIs are hardcoded** — "₹1,284,590" is fake, looks terrible in a live demo
3. **No Purchase Orders module** — entire SRS section 2.2 is a stub
4. **No Manufacturing WIP module** — entire SRS section 2.3 is a stub

---

## Proposed Changes (Priority Order)

### Phase 1: Critical SRS Compliance (Must-Do)

#### 1. Connect InventoryPage to Real API + Add/Edit/Delete
- Replace `MOCK_PRODUCTS` with `fetch('/api/products')` 
- Add "New Product" form modal
- Wire Edit/Delete buttons to real API calls
- **Impact: Highest** — turns a non-functional page into a working module

#### 2. Live Dashboard KPIs from API
- Add new backend endpoint: `GET /api/dashboard/stats`
- Returns: total inventory value, product count, low-stock count, pending order count, active WIP count
- Dashboard fetches and displays real numbers
- **Impact: Very High** — first thing judges see

#### 3. Build Purchases Module (clone Sales pattern)
- New `PurchasesPage.tsx` with master/detail layout
- Reuses same Order API with `type=PURCHASE`
- Status flow: QUOTATION → PAID → COMPLETED
- **Impact: High** — fills an entire SRS gap

#### 4. Build Manufacturing WIP Module
- New `ManufacturingPage.tsx` with list + create form
- Connects to existing `/api/manufacturing` backend
- Input: batch number, raw materials, output products
- Status: WIP → COMPLETED
- **Impact: High** — fills another entire SRS gap

### Phase 2: Hackathon Differentiators (Win Points)

#### 5. Order History + CSV Export
- New `HistoryPage.tsx` (or enhance Reports stub)
- Tabbed view: Sales | Purchases | Manufacturing
- "Export CSV" button that generates and downloads a file
- **Impact: Medium-High** — directly addresses FR23 + export requirement

#### 6. Real-Time Activity Log on Dashboard
- Replace hardcoded "Recent Activity" with actual transaction log
- Backend tracks last 10 actions (order created, status changed, product added)
- Auto-refreshes on dashboard
- **Impact: Medium** — shows system is "alive" during demos

---

## Open Questions

> [!IMPORTANT]
> 1. Should I implement **all 6 items** above, or focus on a specific subset given your remaining hackathon time?
> 2. The SRS mentions a **Desktop app (Windows)** — is this expected, or is web-only acceptable for your hackathon?
> 3. Do you have a **real Groq API key** to make the AI chatbot work during the demo?

## Verification Plan

### Automated
- Backend starts without errors: `npm run dev`
- All API endpoints respond: test via browser subagent
- Frontend builds for production: `npm run build`

### Manual (Browser Testing)
- Login → Dashboard shows **real** KPI numbers
- Inventory → products from database, add/edit/delete works
- Sales → create order → advance through statuses
- Purchases → same flow
- Manufacturing → create batch → complete
- History → filter by type → export CSV
