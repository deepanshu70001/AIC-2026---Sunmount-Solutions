import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';
import { API_URL as API } from '../config/api';

interface CrdtRow {
  product_code: string;
  name: string;
  persisted_quantity: number;
  crdt_quantity: number;
  drift: number;
  p: Record<string, number>;
  n: Record<string, number>;
  last_node: string | null;
  last_merged_at: string | null;
}

interface CrdtSummary {
  generatedAt: string;
  cloudNodeId: string;
  productCount: number;
  replicationNodeCount: number;
  replicationNodes: string[];
  convergedCount: number;
  driftCount: number;
  rows: CrdtRow[];
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

export default function CrdtSyncPage() {
  const [summary, setSummary] = useState<CrdtSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states for manual simulated merge
  const [nodeId, setNodeId] = useState('WAREHOUSE-DESKTOP-TEST');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualN, setManualN] = useState('');
  const [mergePayloadRows, setMergePayloadRows] = useState<Array<{ product_code: string; p: number; n: number }>>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeResult, setMergeResult] = useState<any>(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/inventory/crdt/summary`, { headers: authHeaders() });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch CRDT summary', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleAddPreviewRow = () => {
    if (!selectedProduct || !manualP) return;
    const p = parseInt(manualP, 10);
    const n = parseInt(manualN || '0', 10);
    if (isNaN(p) || isNaN(n)) return;

    setMergePayloadRows(prev => {
      const existing = prev.filter(r => r.product_code !== selectedProduct);
      return [...existing, { product_code: selectedProduct, p, n }];
    });
    setManualP('');
    setManualN('');
  };

  const handleRemovePreviewRow = (code: string) => {
    setMergePayloadRows(prev => prev.filter(r => r.product_code !== code));
  };

  const handleRunSync = async () => {
    if (mergePayloadRows.length === 0) return;
    setMergeLoading(true);
    try {
      const res = await fetch(`${API}/inventory/crdt/merge`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          node_id: nodeId,
          rows: mergePayloadRows
        })
      });
      const data = await res.json();
      setMergeResult(data);
      if (res.ok) {
        setMergePayloadRows([]);
        fetchSummary();
      }
    } catch (e) {
      console.error(e);
      setMergeResult({ error: 'Network error ' + e });
    } finally {
      setMergeLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex">
      <SideNavBar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <TopNavBar />
        <main className="flex-1 pt-16 flex overflow-hidden">
          {/* Main CRDT Tracker */}
          <div className="w-2/3 flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-8 pb-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary-container text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <span className="material-symbols-outlined text-[26px]">cloud_sync</span>
                </div>
                <div>
                  <h1 className="text-3xl font-black text-primary">Distributed Sync</h1>
                  <p className="text-sm font-semibold text-slate-500 tracking-wide">CRDT Conflict-Free Replicated Data Types</p>
                </div>
              </div>

              {loading && !summary ? (
                <div className="p-12 text-center text-slate-400 font-bold animate-pulse">Loading distributed state...</div>
              ) : summary ? (
                <>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-surface-container-lowest p-5 rounded-2xl material-3d-shadow border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nodes</p>
                      <p className="text-2xl font-black text-primary">{summary.replicationNodeCount}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{summary.cloudNodeId} + Remote</p>
                    </div>
                    <div className="bg-surface-container-lowest p-5 rounded-2xl material-3d-shadow border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tracked SKUs</p>
                      <p className="text-2xl font-black text-primary">{summary.productCount}</p>
                    </div>
                    <div className="bg-surface-container-lowest p-5 rounded-2xl material-3d-shadow border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Converged</p>
                      <p className="text-2xl font-black text-green-600">{summary.convergedCount}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">In Sync</p>
                    </div>
                    <div className="bg-surface-container-lowest p-5 rounded-2xl material-3d-shadow border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Drifting</p>
                      <p className={`text-2xl font-black ${summary.driftCount > 0 ? 'text-orange-500' : 'text-slate-400'}`}>{summary.driftCount}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Needs Merge</p>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest rounded-2xl material-3d-shadow overflow-hidden border border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500">
                            <th className="p-4 font-bold">Product</th>
                            <th className="p-4 font-bold text-center">Local Qty</th>
                            <th className="p-4 font-bold text-center border-x border-slate-100">CRDT Resolution</th>
                            <th className="p-4 font-bold text-right" style={{minWidth:'200px'}}>CRDT Vectors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.rows.map(row => (
                            <tr key={row.product_code} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="p-4">
                                <p className="font-bold text-sm text-primary">{row.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{row.product_code}</p>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${row.drift !== 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {row.persisted_quantity}
                                </span>
                              </td>
                              <td className="p-4 text-center border-x border-slate-50 bg-green-50/10">
                                <span className="text-lg font-black text-green-700">{row.crdt_quantity}</span>
                                {row.drift !== 0 && (
                                  <p className="text-[10px] font-bold text-orange-500 mt-1 uppercase">Drift: {row.drift > 0 ? `+${row.drift}` : row.drift}</p>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <div className="text-[10px] font-mono text-slate-500 space-y-1 text-right max-w-[200px] ml-auto">
                                  <div className="bg-blue-50/50 p-1 rounded inline-block text-blue-700">P: {JSON.stringify(row.p)}</div><br/>
                                  <div className="bg-red-50/50 p-1 rounded inline-block text-red-700">N: {JSON.stringify(row.n)}</div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Sync Simulator Panel */}
          <div className="w-1/3 border-l border-slate-200 bg-surface-container-lowest flex flex-col h-full z-10 overflow-hidden shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
            <div className="p-6 border-b border-slate-100 bg-white">
              <h2 className="text-lg font-black text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-500">wifi_off</span>
                Offline Push Simulator
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Simulate a warehouse terminal reconnecting and pushing its local CRDT state to the cloud.</p>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest pl-1 block mb-1">Simulated Node ID</label>
                <input type="text" value={nodeId} onChange={e => setNodeId(e.target.value)}
                  className="w-full bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-600 focus:ring-2 focus:ring-primary/20" />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest">Build Node Payload</h3>
                
                <div>
                  <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20">
                    <option value="">-- Select Product --</option>
                    {summary?.rows.map(r => (
                      <option key={r.product_code} value={r.product_code}>{r.product_code} - {r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1 block">Positive Counter (P)</label>
                    <input type="number" value={manualP} onChange={e => setManualP(e.target.value)} placeholder="e.g. 50" min="0"
                      className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1 block">Negative Counter (N)</label>
                    <input type="number" value={manualN} onChange={e => setManualN(e.target.value)} placeholder="e.g. 10" min="0"
                      className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700" />
                  </div>
                </div>

                <button onClick={handleAddPreviewRow} disabled={!selectedProduct || !manualP}
                  className="w-full bg-slate-200 text-slate-700 font-bold text-xs py-2 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50">
                  Add to Snapshot
                </button>
              </div>

              {mergePayloadRows.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Pending Snapshot</h3>
                  <div className="space-y-2">
                    {mergePayloadRows.map(row => (
                      <div key={row.product_code} className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between shadow-sm">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{row.product_code}</p>
                          <p className="text-[10px] font-mono text-slate-500">P: {row.p} | N: {row.n}</p>
                        </div>
                        <button onClick={() => handleRemovePreviewRow(row.product_code)} className="text-slate-400 hover:text-red-500">
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mergeResult && (
                <div className={`p-4 rounded-xl border text-xs font-mono break-all ${mergeResult.error ? 'bg-error-container text-error border-error/20' : 'bg-green-50 text-green-700 border-green-200'}`}>
                  <p className="font-bold flex items-center gap-1 mb-2 uppercase tracking-wide">
                    {mergeResult.error ? <span className="material-symbols-outlined text-sm">error</span> : <span className="material-symbols-outlined text-sm">check_circle</span>}
                    {mergeResult.error ? 'Merge Failed' : 'Merge Successful'}
                  </p>
                  {JSON.stringify(mergeResult, null, 2)}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={handleRunSync} 
                disabled={mergePayloadRows.length === 0 || mergeLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/30 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {mergeLoading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">send</span>}
                {mergeLoading ? 'Merging...' : 'Push to Cloud Replics'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
