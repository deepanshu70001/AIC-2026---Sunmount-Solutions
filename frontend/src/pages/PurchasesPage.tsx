import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';
import { API_URL as API } from '../config/api';

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

interface PartyInfo {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  paymentTerms: string;
  reliabilityScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  activeOrderCount: number;
}

export default function PurchasesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isNewForm, setIsNewForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<any[]>([{ product_code: '', quantity: 1, price: 0 }]);
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [partyLookupError, setPartyLookupError] = useState('');

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/orders?type=PURCHASE`, { headers: authHeaders() });
      if (res.ok) setOrders(await res.json());
    } catch {}
  };

  useEffect(() => { fetchOrders(); }, []);

  const lookupSupplier = async (id: string) => {
    const normalizedId = id.trim().toUpperCase();
    if (!normalizedId) {
      setPartyInfo(null);
      setPartyLookupError('');
      return;
    }

    try {
      const res = await fetch(`${API}/parties/${normalizedId}?type=SUPPLIER`, {
        headers: authHeaders()
      });
      if (!res.ok) {
        setPartyInfo(null);
        setPartyLookupError('Supplier ID not found in directory');
        return;
      }
      const data = await res.json();
      setPartyInfo(data);
      setSupplierName(data.name || '');
      setPartyLookupError('');
    } catch {
      setPartyInfo(null);
      setPartyLookupError('Could not fetch supplier profile');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplierLabel = supplierId.trim()
      ? `${supplierId.trim().toUpperCase()} - ${supplierName.trim() || 'Unknown Supplier'}`
      : supplierName.trim();

    const res = await fetch(`${API}/orders`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ type: 'PURCHASE', customer_supplier_id: supplierLabel, notes, status: 'QUOTATION', products })
    });
    if (res.ok) {
      fetchOrders();
      setIsNewForm(false);
      setSupplierId('');
      setSupplierName('');
      setPartyInfo(null);
      setPartyLookupError('');
      setNotes('');
      setProducts([{ product_code: '', quantity: 1, price: 0 }]);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${API}/orders/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }) });
    fetchOrders();
    setSelectedOrder((prev: any) => prev ? { ...prev, status } : null);
  };

  const addRow = () => setProducts([...products, { product_code: '', quantity: 1, price: 0 }]);
  const updateRow = (i: number, field: string, value: any) => { const p = [...products]; p[i][field] = value; setProducts(p); };
  const removeRow = (i: number) => { if (products.length > 1) setProducts(products.filter((_, idx) => idx !== i)); };

  const downloadPdf = async (orderId: string) => {
    try {
      const response = await fetch(`${API}/orders/${orderId}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!response.ok) throw new Error('Failed to download PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PurchaseOrder_${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('Failed to download PDF', e);
    }
  };

  const currentRole = localStorage.getItem('role');
  if (currentRole && !['SYSTEM_ADMIN', 'PROCUREMENT_OFFICER'].includes(currentRole)) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex">
        <SideNavBar /><div className="flex-1 ml-64 flex flex-col"><TopNavBar />
          <div className="p-8 flex items-center justify-center flex-1"><h2 className="text-xl text-error font-bold">Access Denied: You do not have Purchasing permissions.</h2></div>
        </div></div>
    );
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex">
      <SideNavBar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <TopNavBar />
        <main className="flex-1 pt-24 flex overflow-hidden bg-surface">
          {/* Left: Orders List */}
          <div className="w-1/3 border-r border-slate-200 bg-surface-container-lowest flex flex-col h-full overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm z-10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-black text-primary tracking-tight">Purchase Orders</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Manifest & Ledger</p>
                </div>
                <button onClick={() => {
                  setIsNewForm(true);
                  setSelectedOrder(null);
                  setSupplierId('');
                  setSupplierName('');
                  setPartyInfo(null);
                  setPartyLookupError('');
                  setNotes('');
                  setProducts([{ product_code: '', quantity: 1, price: 0 }]);
                }}
                  className="bg-primary text-white p-2 rounded-lg hover:bg-primary-fixed transition-colors shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
              {orders.map(order => (
                <div key={order.order_id} onClick={() => { setSelectedOrder(order); setIsNewForm(false); }}
                  className={`p-4 rounded-xl border border-transparent cursor-pointer transition-all ${selectedOrder?.order_id === order.order_id ? 'bg-white shadow-md border-slate-200 scale-[1.02] z-10' : 'hover:bg-white/60 text-on-surface-variant'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-bold text-sm ${selectedOrder?.order_id === order.order_id ? 'text-primary' : 'text-slate-700'}`}>{order.customer_supplier_id || 'Unknown Supplier'}</span>
                    <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-full ${
                      order.status === 'QUOTATION' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'PAID' ? 'bg-orange-100 text-orange-700' :
                      order.status === 'UNPAID' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>{order.status}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {new Date(order.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                      {order.products.length} items
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <div className="p-8 text-center text-slate-400 font-medium mt-10">No purchase orders found.</div>}
            </div>
          </div>

          {/* Right Panel: Detail / Form */}
          <div className="flex-1 bg-white h-full overflow-y-auto p-8 relative">
            {isNewForm ? (
              <form onSubmit={handleCreate} className="flex flex-col gap-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 bg-primary-container text-white rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">local_shipping</span></div>
                  <div>
                    <h2 className="text-xl font-black text-primary">New Purchase Order</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Supplier Procurement</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Supplier ID (Auto-Fill)</label>
                    <input type="text" required value={supplierId}
                      onChange={e => {
                        setSupplierId(e.target.value.toUpperCase());
                        setPartyLookupError('');
                      }}
                      onBlur={() => lookupSupplier(supplierId)}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                    <p className="text-[11px] text-slate-500 mt-1">Try: SUP-2001, SUP-2002, SUP-2003</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Supplier Name</label>
                    <input type="text" required value={supplierName} onChange={e => setSupplierName(e.target.value)}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Notes</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>

                {partyInfo && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex justify-between items-center gap-3 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-widest font-black text-blue-700">Auto-Filled Supplier Profile</p>
                        <p className="font-bold text-primary">{partyInfo.name}</p>
                        <p className="text-xs text-slate-600">{partyInfo.contactPerson} | {partyInfo.phone}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                        partyInfo.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' : partyInfo.riskLevel === 'MEDIUM' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {partyInfo.riskLevel} Risk
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">Payment Terms: {partyInfo.paymentTerms} | Active Orders: {partyInfo.activeOrderCount}</p>
                  </div>
                )}
                {!partyInfo && partyLookupError && (
                  <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-3 text-xs text-orange-700 font-semibold">
                    {partyLookupError}
                  </div>
                )}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-sm text-primary mb-4 flex justify-between items-center">
                    <span>Order Products (Unlimited Rows)</span>
                    <button type="button" onClick={addRow} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:border-primary">
                      <span className="material-symbols-outlined text-[14px]">add</span> Add Item
                    </button>
                  </h3>
                  {products.map((p, i) => (
                    <div key={i} className="flex gap-2 items-end mb-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Product Code</label>
                        <input type="text" required value={p.product_code} onChange={e => updateRow(i, 'product_code', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Qty</label>
                        <input type="number" min="1" required value={p.quantity} onChange={e => updateRow(i, 'quantity', parseInt(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="w-32">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Unit Price (₹)</label>
                        <input type="number" min="0" step="0.01" required value={p.price} onChange={e => updateRow(i, 'price', parseFloat(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <button type="button" onClick={() => removeRow(i)} className="p-2 text-slate-400 hover:text-error bg-white border border-slate-200 rounded-lg mb-[1px]">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Order Total:</span>
                    <span className="text-lg font-black text-primary">₹{products.reduce((a, p) => a + (p.price * p.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button type="submit" className="primary-gradient text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-all">Submit Purchase Order</button>
                </div>
              </form>
            ) : selectedOrder ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-primary mb-1">{selectedOrder.customer_supplier_id || 'Unknown Supplier'}</h2>
                    <p className="text-sm text-slate-500 font-mono">ID: {selectedOrder.order_id}</p>
                    <p className="text-xs text-slate-400 mt-2">{new Date(selectedOrder.date).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full ${
                      selectedOrder.status === 'QUOTATION' ? 'bg-blue-100 text-blue-700' :
                      selectedOrder.status === 'PAID' ? 'bg-orange-100 text-orange-700' :
                      selectedOrder.status === 'UNPAID' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>{selectedOrder.status}</span>
                    <p className="text-2xl font-black text-primary mt-4">₹{selectedOrder.products.reduce((a: any, p: any) => a + (p.price * p.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    <button 
                      onClick={() => downloadPdf(selectedOrder.order_id)}
                      className="mt-2 flex items-center justify-end gap-1 text-blue-600 hover:text-blue-800 text-sm font-bold w-full"
                    >
                      <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                      Download PO
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-6 border border-slate-100 mb-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Order Manifest</h3>
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-slate-200 text-xs text-slate-400"><th className="pb-2">Product</th><th className="pb-2 text-center">QTY</th><th className="pb-2 text-right">UNIT PRICE</th><th className="pb-2 text-right">TOTAL</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.products.map((p: any, i: number) => (
                        <tr key={i} className="text-sm font-medium text-on-surface-variant">
                          <td className="py-3 font-mono text-xs">{p.product_code}</td>
                          <td className="py-3 text-center">{p.quantity}</td>
                          <td className="py-3 text-right">₹{p.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 text-right font-black text-primary">₹{(p.price * p.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3 mt-auto">
                  {selectedOrder.status === 'QUOTATION' && (
                    <>
                      <button onClick={() => updateStatus(selectedOrder.order_id, 'UNPAID')} className="bg-red-100 text-red-700 px-6 py-2.5 rounded-xl font-bold hover:bg-red-200 transition-colors">Mark as Unpaid</button>
                      <button onClick={() => updateStatus(selectedOrder.order_id, 'PAID')} className="bg-orange-100 text-orange-700 px-6 py-2.5 rounded-xl font-bold hover:bg-orange-200 transition-colors">Mark as Paid</button>
                    </>
                  )}
                  {selectedOrder.status === 'UNPAID' && (
                    <button onClick={() => updateStatus(selectedOrder.order_id, 'PAID')} className="bg-orange-100 text-orange-700 px-6 py-2.5 rounded-xl font-bold hover:bg-orange-200 transition-colors">Move to Paid</button>
                  )}
                  {selectedOrder.status === 'PAID' && (
                    <button onClick={() => updateStatus(selectedOrder.order_id, 'COMPLETED')} className="bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-500/30 hover:scale-105 transition-all">Complete Order</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-6xl">shopping_cart</span>
                </div>
                <p className="text-lg font-bold">Select a purchase order</p>
                <p className="text-sm">Click an item from the list to view full details</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
