import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';

const API = 'http://localhost:3001/api';
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function ManufacturingPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [rawMaterials, setRawMaterials] = useState<any[]>([{ product_code: '', quantity: 1 }]);
  const [output, setOutput] = useState<any[]>([{ product_code: '', quantity: 1 }]);

  const fetch_ = async () => {
    try {
      const res = await fetch(`${API}/manufacturing`, { headers: authHeaders() });
      if (res.ok) setBatches(await res.json());
    } catch {}
  };

  useEffect(() => { fetch_(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/manufacturing`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ batch_number: batchNumber, raw_materials: rawMaterials, output })
    });
    if (res.ok) { fetch_(); setShowForm(false); setBatchNumber(''); setRawMaterials([{ product_code: '', quantity: 1 }]); setOutput([{ product_code: '', quantity: 1 }]); }
  };

  const completeBatch = async (id: string, outputData: any[]) => {
    await fetch(`${API}/manufacturing/${id}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ status: 'COMPLETED', output: outputData })
    });
    fetch_();
    setSelected((prev: any) => prev ? { ...prev, status: 'COMPLETED' } : null);
  };

  const addRawRow = () => setRawMaterials([...rawMaterials, { product_code: '', quantity: 1 }]);
  const addOutRow = () => setOutput([...output, { product_code: '', quantity: 1 }]);
  const updateRaw = (i: number, f: string, v: any) => { const r = [...rawMaterials]; r[i][f] = v; setRawMaterials(r); };
  const updateOut = (i: number, f: string, v: any) => { const o = [...output]; o[i][f] = v; setOutput(o); };
  const removeRaw = (i: number) => { if (rawMaterials.length > 1) setRawMaterials(rawMaterials.filter((_, idx) => idx !== i)); };
  const removeOut = (i: number) => { if (output.length > 1) setOutput(output.filter((_, idx) => idx !== i)); };

  const currentRole = localStorage.getItem('role');
  if (currentRole && !['SYSTEM_ADMIN', 'PRODUCTION_TECHNICIAN'].includes(currentRole)) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex">
        <SideNavBar /><div className="flex-1 ml-64 flex flex-col"><TopNavBar />
          <div className="p-8 flex items-center justify-center flex-1"><h2 className="text-xl text-error font-bold">Access Denied: Manufacturing permissions required.</h2></div>
        </div></div>
    );
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex">
      <SideNavBar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <TopNavBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8f9fa] flex flex-col lg:flex-row gap-6">
          {/* Left: Batch List */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-black text-primary">Manufacturing WIP</h2>
              <button onClick={() => { setShowForm(true); setSelected(null); }}
                className="bg-primary text-white p-2 rounded-lg hover:bg-primary-fixed transition-colors shadow-md">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>
            <div className="bg-surface-container-lowest flex-1 rounded-2xl material-3d-shadow overflow-y-auto border border-slate-200">
              {batches.map(b => (
                <div key={b.batch_number} onClick={() => { setSelected(b); setShowForm(false); }}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selected?.batch_number === b.batch_number ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-slate-50'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-primary">Batch {b.batch_number}</span>
                    <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-full ${
                      b.status === 'WIP' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>{b.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(b.start_date).toLocaleDateString()}</div>
                  <div className="flex gap-4 mt-2 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">input</span>{b.raw_materials.length} inputs</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">output</span>{b.output.length} outputs</span>
                  </div>
                </div>
              ))}
              {batches.length === 0 && <div className="p-8 text-center text-slate-400 font-medium">No manufacturing batches found.</div>}
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-full lg:w-2/3 bg-surface-container-lowest rounded-2xl material-3d-shadow p-6 border border-slate-200 overflow-y-auto">
            {showForm ? (
              <form onSubmit={handleCreate} className="flex flex-col gap-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 bg-primary-container text-white rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">factory</span></div>
                  <div>
                    <h2 className="text-xl font-black text-primary">New Manufacturing Batch</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Work-in-Progress Registration</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Batch Number</label>
                  <input type="text" required value={batchNumber} onChange={e => setBatchNumber(e.target.value)}
                    className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" placeholder="e.g. BATCH-001" />
                </div>

                {/* Raw Materials */}
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
                  <h3 className="font-bold text-sm text-error mb-3 flex justify-between items-center">
                    <span>Raw Materials (Input — will be deducted)</span>
                    <button type="button" onClick={addRawRow} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:border-primary">
                      <span className="material-symbols-outlined text-[14px]">add</span> Add
                    </button>
                  </h3>
                  {rawMaterials.map((r, i) => (
                    <div key={i} className="flex gap-2 items-end mb-2">
                      <div className="flex-1">
                        <input type="text" required placeholder="Product code" value={r.product_code} onChange={e => updateRaw(i, 'product_code', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="w-24">
                        <input type="number" min="1" required value={r.quantity} onChange={e => updateRaw(i, 'quantity', parseInt(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <button type="button" onClick={() => removeRaw(i)} className="p-2 text-slate-400 hover:text-error"><span className="material-symbols-outlined text-[18px]">close</span></button>
                    </div>
                  ))}
                </div>

                {/* Output */}
                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100">
                  <h3 className="font-bold text-sm text-green-700 mb-3 flex justify-between items-center">
                    <span>Output Products (will be added on completion)</span>
                    <button type="button" onClick={addOutRow} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:border-primary">
                      <span className="material-symbols-outlined text-[14px]">add</span> Add
                    </button>
                  </h3>
                  {output.map((o, i) => (
                    <div key={i} className="flex gap-2 items-end mb-2">
                      <div className="flex-1">
                        <input type="text" required placeholder="Product code" value={o.product_code} onChange={e => updateOut(i, 'product_code', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="w-24">
                        <input type="number" min="1" required value={o.quantity} onChange={e => updateOut(i, 'quantity', parseInt(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <button type="button" onClick={() => removeOut(i)} className="p-2 text-slate-400 hover:text-error"><span className="material-symbols-outlined text-[18px]">close</span></button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="primary-gradient text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-all">Start Production</button>
                </div>
              </form>
            ) : selected ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-primary mb-1">Batch {selected.batch_number}</h2>
                    <p className="text-xs text-slate-400">Started: {new Date(selected.start_date).toLocaleString()}</p>
                    {selected.end_date && <p className="text-xs text-green-600 font-bold mt-1">Completed: {new Date(selected.end_date).toLocaleString()}</p>}
                  </div>
                  <span className={`text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full ${
                    selected.status === 'WIP' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>{selected.status}</span>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="bg-red-50/50 rounded-xl p-4 border border-red-100">
                    <h3 className="text-sm font-bold text-error uppercase tracking-widest mb-3">Raw Materials (Input)</h3>
                    {selected.raw_materials.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between py-2 border-b border-red-100 last:border-0 text-sm">
                        <span className="font-mono text-xs">{r.product_code}</span>
                        <span className="font-bold">{r.quantity} units</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-green-50/50 rounded-xl p-4 border border-green-100">
                    <h3 className="text-sm font-bold text-green-700 uppercase tracking-widest mb-3">Output Products</h3>
                    {selected.output.map((o: any, i: number) => (
                      <div key={i} className="flex justify-between py-2 border-b border-green-100 last:border-0 text-sm">
                        <span className="font-mono text-xs">{o.product_code}</span>
                        <span className="font-bold">{o.quantity} units</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.status === 'WIP' && (
                  <div className="flex justify-end mt-auto">
                    <button onClick={() => completeBatch(selected.batch_number, selected.output)}
                      className="bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-500/30 hover:scale-105 transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      Mark as Completed
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[64px] mb-4 opacity-20">factory</span>
                <p className="font-medium">Select a batch or start new production</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
