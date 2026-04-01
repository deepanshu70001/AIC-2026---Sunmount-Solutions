import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { API_URL as API } from '../config/api';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface DashboardStats {
  totalProducts: number;
  totalInventoryValue: number;
  lowStockCount: number;
  criticalCount: number;
  pendingOrders: number;
  activeBatches: number;
  activity: any[];
}

interface RiskSummary {
  stockoutRiskCount: number;
  delayedPurchaseCount: number;
  reorderRecommendationCount: number;
  atRiskOrders: Array<{
    order_id: string;
    customer_supplier_id: string;
    ageDays: number;
    shortageCount: number;
  }>;
  reorderRecommendations: Array<{
    product_code: string;
    name: string;
    projectedQty: number;
    recommendedQty: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

interface ComplianceSummary {
  filingHealth: {
    compliantCount: number;
    returnPendingCount: number;
    blockedCount: number;
    blockedParties: string[];
  };
  ewayBill: {
    thresholdInr: number;
    totalDispatchedOrders: number;
    generatedCount: number;
    requiredPendingCount: number;
    blockedOpenDispatchRisk: number;
  };
  itcReconciliation: {
    expectedItc: number;
    matchedItc: number;
    mismatchItc: number;
    discrepancyCount: number;
    discrepancies: Array<{
      order_id: string;
      supplier: string;
      mismatchPercent: number;
      mismatchItc: number;
      filingStatus: string;
    }>;
  };
}

interface CrdtSummary {
  cloudNodeId: string;
  productCount: number;
  replicationNodeCount: number;
  convergedCount: number;
  driftCount: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [crdtSummary, setCrdtSummary] = useState<CrdtSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, riskRes, complianceRes, crdtRes] = await Promise.all([
          fetch(`${API}/dashboard/stats`, { headers: authHeaders() }),
          fetch(`${API}/insights/risk-summary`, { headers: authHeaders() }),
          fetch(`${API}/compliance/summary`, { headers: authHeaders() }),
          fetch(`${API}/inventory/crdt/summary`, { headers: authHeaders() }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (riskRes.ok) setRiskSummary(await riskRes.json());
        if (complianceRes.ok) setComplianceSummary(await complianceRes.json());
        if (crdtRes.ok) setCrdtSummary(await crdtRes.json());
      } catch {} finally { setLoading(false); }
    };
    load();
    const interval = setInterval(load, 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const kpis = stats ? [
    { icon: 'payments', label: 'Total Stock Value', value: formatCurrency(stats.totalInventoryValue), badge: `${stats.totalProducts} SKUs`, badgeColor: 'bg-secondary-container text-secondary' },
    { icon: 'warning', label: 'Low Stock Alerts', value: `${stats.lowStockCount} items`, badge: `${stats.criticalCount} Critical`, badgeColor: 'bg-error-container text-error' },
    { icon: 'pending_actions', label: 'Pending Orders', value: `${stats.pendingOrders} orders`, badge: null, badgeColor: '' },
    { icon: 'conveyor_belt', label: 'Active Batches', value: `${stats.activeBatches} WIP`, badge: 'Active', badgeColor: 'bg-primary-fixed text-primary' },
  ] : [];

  const pieData = stats ? [
    { name: 'Healthy Stock', value: stats.totalProducts - stats.lowStockCount },
    { name: 'Low Stock', value: stats.lowStockCount - stats.criticalCount },
    { name: 'Critical', value: stats.criticalCount },
  ].filter(d => d.value > 0) : [];
  const COLORS = ['#172434', '#f59e0b', '#ba1a1a'];

  const getActivityIcon = (type: string) => {
    switch (type) { case 'sale': return 'payments'; case 'purchase': return 'shopping_cart'; case 'manufacturing': return 'factory'; default: return 'info'; }
  };
  const getActivityColor = (type: string) => {
    switch (type) { case 'sale': return 'bg-secondary-container text-secondary'; case 'purchase': return 'bg-primary-fixed text-primary'; case 'manufacturing': return 'bg-orange-100 text-orange-700'; default: return 'bg-slate-100 text-slate-500'; }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <SideNavBar />
      <TopNavBar />
      <main className="ml-64 pt-24 px-8 pb-12">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Warehouse Overview</h2>
            <p className="text-on-surface-variant mt-1 font-medium">
              {loading ? 'Loading real-time data...' : 'Live data from database'}
              {!loading && <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 font-bold"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>LIVE</span>}
            </p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow animate-pulse">
              <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            </div>
          )) : kpis.map((k, i) => (
            <div key={i} className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow flex flex-col justify-between group hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-primary-fixed rounded-lg text-primary"><span className="material-symbols-outlined">{k.icon}</span></div>
                {k.badge && <span className={`text-xs font-bold px-2 py-1 rounded-full ${k.badgeColor}`}>{k.badge}</span>}
              </div>
              <div>
                <p className="text-sm font-medium text-on-surface-variant">{k.label}</p>
                <p className="text-2xl font-black text-primary mt-1">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-8 mb-8">
          {/* Stock Health Pie Chart */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl material-3d-shadow p-8 flex flex-col">
            <h3 className="text-xl font-bold text-primary mb-2">Stock Health</h3>
            <p className="text-sm text-on-surface-variant mb-6">Inventory status breakdown</p>
            <div className="flex-1 w-full min-h-[200px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                      {pieData.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-400">No product data yet</div>}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl material-3d-shadow p-8">
            <h3 className="text-xl font-bold text-primary mb-6">Recent Activity</h3>
            {stats?.activity && stats.activity.length > 0 ? (
              <div className="space-y-4">
                {stats.activity.map((a: any, i: number) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityColor(a.type)}`}>
                      <span className="material-symbols-outlined text-lg">{getActivityIcon(a.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary truncate">{a.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(a.date).toLocaleString()}</p>
                    </div>
                    <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-full flex-shrink-0 ${
                      a.status === 'DISPATCH' || a.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      a.status === 'UNPAID' ? 'bg-red-100 text-red-700' :
                      a.status === 'WIP' || a.status === 'PACKING' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{a.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-30">history</span>
                <p>No activity yet. Create orders to see them here!</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl material-3d-shadow p-6 border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-xl font-bold text-primary">Real-World Fulfillment Risks</h3>
              <p className="text-xs text-slate-500">Stockout prediction + procurement action recommendations</p>
            </div>
            <span className="text-[11px] uppercase tracking-wider font-black px-3 py-1 rounded-full bg-primary/10 text-primary">
              Differentiator Feature
            </span>
          </div>

          {riskSummary ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
                  <p className="text-xs uppercase tracking-widest font-black text-red-700">Stockout Risks</p>
                  <p className="text-2xl font-black text-red-700 mt-1">{riskSummary.stockoutRiskCount}</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-xs uppercase tracking-widest font-black text-orange-700">Delayed Purchases</p>
                  <p className="text-2xl font-black text-orange-700 mt-1">{riskSummary.delayedPurchaseCount}</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs uppercase tracking-widest font-black text-blue-700">Reorder Suggestions</p>
                  <p className="text-2xl font-black text-blue-700 mt-1">{riskSummary.reorderRecommendationCount}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-600 mb-3">Orders at Risk</h4>
                  {riskSummary.atRiskOrders.length > 0 ? (
                    <div className="space-y-2">
                      {riskSummary.atRiskOrders.map((order) => (
                        <div key={order.order_id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <p className="font-bold text-primary">{order.customer_supplier_id}</p>
                            <p className="text-xs text-slate-500">ID {order.order_id.slice(0, 8)}... | {order.shortageCount} SKU shortages</p>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-red-100 text-red-700">
                            {order.ageDays}d old
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-700 font-semibold">No stockout risks detected in open sales pipeline.</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-600 mb-3">Top Reorder Actions</h4>
                  {riskSummary.reorderRecommendations.length > 0 ? (
                    <div className="space-y-2">
                      {riskSummary.reorderRecommendations.slice(0, 5).map((item) => (
                        <div key={item.product_code} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <p className="font-bold text-primary">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.product_code} | projected {item.projectedQty} units</p>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                            item.severity === 'HIGH' ? 'bg-red-100 text-red-700' : item.severity === 'MEDIUM' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            +{item.recommendedQty}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-700 font-semibold">No immediate reorder actions required.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Loading risk insights...</p>
          )}
        </div>

        <div className="mt-8 bg-surface-container-lowest rounded-xl material-3d-shadow p-6 border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-xl font-bold text-primary">GST and E-Way Bill Control Tower</h3>
              <p className="text-xs text-slate-500">Zero-touch compliance monitoring for dispatch continuity</p>
            </div>
            <span className="text-[11px] uppercase tracking-wider font-black px-3 py-1 rounded-full bg-green-100 text-green-700">
              Compliance 2.0
            </span>
          </div>

          {complianceSummary ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-green-100 bg-green-50/70 p-4">
                  <p className="text-xs uppercase tracking-widest font-black text-green-700">Compliant Parties</p>
                  <p className="text-2xl font-black text-green-700 mt-1">{complianceSummary.filingHealth.compliantCount}</p>
                  <p className="text-xs text-green-700 mt-1">{complianceSummary.filingHealth.returnPendingCount} pending returns</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
                  <p className="text-xs uppercase tracking-widest font-black text-red-700">Blocked Dispatch Risk</p>
                  <p className="text-2xl font-black text-red-700 mt-1">{complianceSummary.ewayBill.blockedOpenDispatchRisk}</p>
                  <p className="text-xs text-red-700 mt-1">{complianceSummary.filingHealth.blockedCount} blocked party profiles</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs uppercase tracking-widest font-black text-blue-700">ITC Mismatch</p>
                  <p className="text-2xl font-black text-blue-700 mt-1">{formatCurrency(complianceSummary.itcReconciliation.mismatchItc)}</p>
                  <p className="text-xs text-blue-700 mt-1">{complianceSummary.itcReconciliation.discrepancyCount} flagged suppliers</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-600 mb-3">E-Way Bill Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Threshold (INR)</span>
                      <span className="font-black text-primary">{formatCurrency(complianceSummary.ewayBill.thresholdInr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dispatched Orders</span>
                      <span className="font-black text-primary">{complianceSummary.ewayBill.totalDispatchedOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bills Generated</span>
                      <span className="font-black text-green-700">{complianceSummary.ewayBill.generatedCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Required Pending</span>
                      <span className="font-black text-red-700">{complianceSummary.ewayBill.requiredPendingCount}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-600 mb-3">ITC Reconciliation Alerts</h4>
                  {complianceSummary.itcReconciliation.discrepancies.length > 0 ? (
                    <div className="space-y-2">
                      {complianceSummary.itcReconciliation.discrepancies.slice(0, 5).map((item) => (
                        <div key={item.order_id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <p className="font-bold text-primary">{item.supplier}</p>
                            <p className="text-xs text-slate-500">Order {item.order_id.slice(0, 8)}... | {item.filingStatus}</p>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-red-100 text-red-700">
                            {item.mismatchPercent}% ({formatCurrency(item.mismatchItc)})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-700 font-semibold">No major ITC mismatches detected.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Loading compliance insights...</p>
          )}
        </div>

        <div className="mt-8 bg-surface-container-lowest rounded-xl material-3d-shadow p-6 border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-xl font-bold text-primary">Distributed Sync Resilience (CRDT)</h3>
              <p className="text-xs text-slate-500">Offline-first PN-counter replication health across cloud and edge nodes</p>
            </div>
            <span className="text-[11px] uppercase tracking-wider font-black px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
              CRDT Engine
            </span>
          </div>

          {crdtSummary ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-xs uppercase tracking-widest font-black text-indigo-700">Cloud Node</p>
                <p className="text-sm font-black text-indigo-700 mt-1">{crdtSummary.cloudNodeId}</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-xs uppercase tracking-widest font-black text-blue-700">Replication Nodes</p>
                <p className="text-2xl font-black text-blue-700 mt-1">{crdtSummary.replicationNodeCount}</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50/70 p-4">
                <p className="text-xs uppercase tracking-widest font-black text-green-700">Converged SKUs</p>
                <p className="text-2xl font-black text-green-700 mt-1">{crdtSummary.convergedCount}/{crdtSummary.productCount}</p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
                <p className="text-xs uppercase tracking-widest font-black text-red-700">Drifted SKUs</p>
                <p className="text-2xl font-black text-red-700 mt-1">{crdtSummary.driftCount}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading CRDT replication summary...</p>
          )}
        </div>
      </main>
      <div className="fixed inset-0 pointer-events-none -z-10 bg-surface">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full"></div>
      </div>
    </div>
  );
};

export default Dashboard;
