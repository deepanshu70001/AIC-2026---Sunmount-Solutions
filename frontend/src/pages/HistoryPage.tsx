import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';
import { API_URL as API } from '../config/api';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

type Tab = 'SALE' | 'PURCHASE' | 'MANUFACTURING';

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>('SALE');
  const [orders, setOrders] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (tab === 'MANUFACTURING') {
          const res = await fetch(`${API}/manufacturing`, { headers: authHeaders() });
          if (res.ok) setBatches(await res.json());
        } else {
          const res = await fetch(`${API}/orders?type=${tab}`, { headers: authHeaders() });
          if (res.ok) setOrders(await res.json());
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [tab]);

  const exportCSV = () => {
    const token = localStorage.getItem('token');
    const url = tab === 'MANUFACTURING'
      ? `${API}/export/manufacturing`
      : `${API}/export/orders?type=${tab}`;
    
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${tab.toLowerCase()}_history_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
      });
  };

  const tabConfig = [
    { key: 'SALE' as Tab, label: 'Sales', icon: 'point_of_sale', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { key: 'PURCHASE' as Tab, label: 'Purchases', icon: 'shopping_cart', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { key: 'MANUFACTURING' as Tab, label: 'Manufacturing', icon: 'factory', color: 'text-green-600 bg-green-50 border-green-200' },
  ];

  const statusColor = (s: string) => {
    switch (s) {
      case 'QUOTATION': return 'bg-blue-100 text-blue-700';
      case 'PACKING': case 'PAID': case 'WIP': return 'bg-orange-100 text-orange-700';
      case 'UNPAID': return 'bg-red-100 text-red-700';
      case 'DISPATCH': case 'COMPLETED': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const filteredOrders = orders.filter(o =>
    (o.customer_supplier_id || '').toLowerCase().includes(search.toLowerCase()) ||
    o.order_id.toLowerCase().includes(search.toLowerCase())
  );
  const filteredBatches = batches.filter(b => b.batch_number.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-surface text-on-surface min-h-screen flex">
      <SideNavBar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <TopNavBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8f9fa]">
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-black text-primary">Order History & Reports</h2>
              <p className="text-sm text-slate-500 mt-1">Filter, search, and export all transaction records</p>
            </div>
            <button onClick={exportCSV} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-all flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-3 mb-6">
            {tabConfig.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all ${
                  tab === t.key ? t.color + ' shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}>
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20"
              placeholder={`Search ${tab === 'MANUFACTURING' ? 'batch numbers...' : 'orders by ID or customer...'}`} />
          </div>

          {/* Data Table */}
          <div className="bg-surface-container-lowest rounded-2xl material-3d-shadow border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 animate-pulse">Loading records...</div>
            ) : tab === 'MANUFACTURING' ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-6 py-4">Batch Number</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Raw Materials</th>
                    <th className="px-6 py-4 text-center">Output</th>
                    <th className="px-6 py-4">Start Date</th>
                    <th className="px-6 py-4">End Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map(b => (
                    <tr key={b.batch_number} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-sm text-primary">{b.batch_number}</td>
                      <td className="px-6 py-4"><span className={`text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-full ${statusColor(b.status)}`}>{b.status}</span></td>
                      <td className="px-6 py-4 text-center text-sm">{b.raw_materials.map((r: any) => `${r.product_code}×${r.quantity}`).join(', ')}</td>
                      <td className="px-6 py-4 text-center text-sm">{b.output.map((o: any) => `${o.product_code}×${o.quantity}`).join(', ')}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(b.start_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{b.end_date ? new Date(b.end_date).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {filteredBatches.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No manufacturing records found.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">{tab === 'SALE' ? 'Customer' : 'Supplier'}</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Items</th>
                    <th className="px-6 py-4 text-right">Total (₹)</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(o => {
                    const total = o.products.reduce((a: number, p: any) => a + (p.price * p.quantity), 0);
                    return (
                      <tr key={o.order_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">{o.order_id.substring(0, 12)}...</td>
                        <td className="px-6 py-4 font-bold text-sm text-primary">{o.customer_supplier_id || '—'}</td>
                        <td className="px-6 py-4"><span className={`text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-full ${statusColor(o.status)}`}>{o.status}</span></td>
                        <td className="px-6 py-4 text-center text-sm">{o.products.reduce((a: number, p: any) => a + p.quantity, 0)}</td>
                        <td className="px-6 py-4 text-right font-bold text-sm text-primary">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-xs text-slate-500">{new Date(o.date).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                  {filteredOrders.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No {tab.toLowerCase()} orders found.</td></tr>}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 text-right text-xs text-slate-400">
            {tab === 'MANUFACTURING' ? `${filteredBatches.length} batch records` : `${filteredOrders.length} order records`}
          </div>
        </main>
      </div>
    </div>
  );
}
