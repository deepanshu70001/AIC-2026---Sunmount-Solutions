import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const API = 'http://localhost:3001/api';
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

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/dashboard/stats`, { headers: authHeaders() });
        if (res.ok) setStats(await res.json());
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
      </main>
      <div className="fixed inset-0 pointer-events-none -z-10 bg-surface">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full"></div>
      </div>
    </div>
  );
};

export default Dashboard;
