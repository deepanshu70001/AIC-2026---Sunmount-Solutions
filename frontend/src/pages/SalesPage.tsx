import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';
import { API_URL as API } from '../config/api';

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

type DispatchMode = 'ROAD' | 'RAIL' | 'AIR' | 'SHIP';

type SalesLine = {
  product_code: string;
  quantity: number;
  price: number;
};

type SalesOrder = {
  order_id: string;
  customer_supplier_id: string;
  status: 'QUOTATION' | 'PACKING' | 'DISPATCH';
  date: string;
  notes?: string | null;
  products: SalesLine[];
  invoice_number?: string | null;
  transport_details?: {
    vehicle_number?: string;
    transporter_id?: string;
    distance_km?: number;
    mode?: DispatchMode;
  } | null;
  eway_bill_required?: boolean;
  eway_bill_status?: string | null;
  eway_bill_number?: string | null;
  eway_bill_valid_upto?: string | null;
  compliance_meta?: {
    filingStatus?: string;
    filingReason?: string;
    taxSummary?: {
      taxableValue?: number;
      gstValue?: number;
      invoiceValue?: number;
    };
  } | null;
};

type DispatchForm = {
  invoice_number: string;
  vehicle_number: string;
  transporter_id: string;
  distance_km: number;
  mode: DispatchMode;
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const parseMaybeObject = <T,>(value: unknown): T | null => {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
};

const normalizeOrder = (raw: any): SalesOrder => ({
  ...raw,
  products: Array.isArray(raw?.products) ? raw.products : [],
  transport_details: parseMaybeObject<SalesOrder['transport_details']>(raw?.transport_details),
  compliance_meta: parseMaybeObject<SalesOrder['compliance_meta']>(raw?.compliance_meta)
});

const currency = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isNewForm, setIsNewForm] = useState(false);
  const [pageError, setPageError] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<SalesLine[]>([{ product_code: '', quantity: 1, price: 0 }]);
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [partyLookupError, setPartyLookupError] = useState('');

  const [dispatchForm, setDispatchForm] = useState<DispatchForm>({
    invoice_number: '',
    vehicle_number: '',
    transporter_id: 'TRN-001',
    distance_km: 120,
    mode: 'ROAD'
  });
  const [dispatchError, setDispatchError] = useState('');
  const [dispatchSaving, setDispatchSaving] = useState(false);

  const setDispatchDefaultsFromOrder = (order: SalesOrder | null) => {
    if (!order) return;
    const transport = order.transport_details || {};
    setDispatchForm({
      invoice_number: order.invoice_number || '',
      vehicle_number: transport.vehicle_number || '',
      transporter_id: transport.transporter_id || 'TRN-001',
      distance_km: Number(transport.distance_km) > 0 ? Number(transport.distance_km) : 120,
      mode: transport.mode || 'ROAD'
    });
    setDispatchError('');
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/orders?type=SALE`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load sales orders');
      }
      const data = (await res.json()) as any[];
      const normalized = data.map(normalizeOrder);
      setOrders(normalized);
      setSelectedOrder(prev => {
        if (!prev) return null;
        return normalized.find(order => order.order_id === prev.order_id) || null;
      });
      setPageError('');
    } catch (error: any) {
      setPageError(error?.message || 'Unable to load sales orders right now');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const lookupCustomer = async (id: string) => {
    const normalizedId = id.trim().toUpperCase();
    if (!normalizedId) {
      setPartyInfo(null);
      setPartyLookupError('');
      return;
    }

    try {
      const res = await fetch(`${API}/parties/${normalizedId}?type=CUSTOMER`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        setPartyInfo(null);
        setPartyLookupError('Customer ID not found in directory');
        return;
      }
      const data = await res.json();
      setPartyInfo(data);
      setCustomerName(data.name || '');
      setPartyLookupError('');
    } catch {
      setPartyInfo(null);
      setPartyLookupError('Could not fetch customer profile');
    }
  };

  const resetCreateForm = () => {
    setCustomerId('');
    setCustomerName('');
    setNotes('');
    setProducts([{ product_code: '', quantity: 1, price: 0 }]);
    setPartyInfo(null);
    setPartyLookupError('');
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerLabel = customerId.trim()
        ? `${customerId.trim().toUpperCase()} - ${customerName.trim() || 'Unknown Customer'}`
        : customerName.trim();

      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          type: 'SALE',
          customer_supplier_id: customerLabel,
          notes,
          status: 'QUOTATION',
          products
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create order');
      }

      await fetchOrders();
      setIsNewForm(false);
      resetCreateForm();
      setPageError('');
    } catch (error: any) {
      setPageError(error?.message || 'Failed to create order');
    }
  };

  const updateOrderStatus = async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`${API}/orders/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to update order');
    }

    const updated = normalizeOrder(await res.json());
    setOrders(prev => prev.map(order => (order.order_id === updated.order_id ? updated : order)));
    setSelectedOrder(updated);
    setDispatchDefaultsFromOrder(updated);
  };

  const advanceToPacking = async (id: string) => {
    try {
      await updateOrderStatus(id, { status: 'PACKING' });
      setPageError('');
    } catch (error: any) {
      setPageError(error?.message || 'Failed to move order to packing');
    }
  };

  const dispatchOrder = async () => {
    if (!selectedOrder) return;
    setDispatchSaving(true);
    setDispatchError('');

    try {
      await updateOrderStatus(selectedOrder.order_id, {
        status: 'DISPATCH',
        invoice_number: dispatchForm.invoice_number.trim() || undefined,
        transport_details: {
          vehicle_number: dispatchForm.vehicle_number.trim().toUpperCase(),
          transporter_id: dispatchForm.transporter_id.trim().toUpperCase(),
          distance_km: Number(dispatchForm.distance_km),
          mode: dispatchForm.mode
        }
      });
      setPageError('');
    } catch (error: any) {
      setDispatchError(error?.message || 'Dispatch failed');
    } finally {
      setDispatchSaving(false);
    }
  };

  const addProductRow = () => {
    setProducts([...products, { product_code: '', quantity: 1, price: 0 }]);
  };

  const updateProductRow = (index: number, field: keyof SalesLine, value: string | number) => {
    const nextProducts = [...products];
    if (field === 'quantity' || field === 'price') {
      nextProducts[index][field] = Number(value) as never;
    } else {
      nextProducts[index][field] = String(value) as never;
    }
    setProducts(nextProducts);
  };

  const removeProductRow = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const orderItemCount = (order: SalesOrder) => order.products.reduce((acc, line) => acc + Number(line.quantity || 0), 0);
  const orderTotal = (order: SalesOrder) => order.products.reduce((acc, line) => acc + Number(line.price || 0) * Number(line.quantity || 0), 0);

  const currentRole = localStorage.getItem('role');
  if (currentRole && !['SYSTEM_ADMIN', 'SALES_EXECUTIVE', 'LOGISTICS_COORDINATOR'].includes(currentRole)) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex">
        <SideNavBar />
        <div className="flex-1 ml-64 flex flex-col">
          <TopNavBar />
          <div className="p-8 flex items-center justify-center flex-1">
            <h2 className="text-xl text-error font-bold">Access Denied: You do not have Sales permissions.</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex">
      <SideNavBar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <TopNavBar />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8f9fa] dark:bg-slate-900 flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/3 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-black text-primary">Sales Operations</h2>
              {['SYSTEM_ADMIN', 'SALES_EXECUTIVE'].includes(currentRole || '') && (
                <button
                  onClick={() => {
                    setIsNewForm(true);
                    setSelectedOrder(null);
                    resetCreateForm();
                    setPageError('');
                  }}
                  className="bg-primary text-white p-2 rounded-lg hover:bg-primary-fixed transition-colors shadow-md"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              )}
            </div>

            <div className="bg-surface-container-lowest flex-1 rounded-2xl material-3d-shadow overflow-y-auto border border-slate-200">
              {orders.map(order => (
                <div
                  key={order.order_id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setDispatchDefaultsFromOrder(order);
                    setIsNewForm(false);
                  }}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selectedOrder?.order_id === order.order_id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-primary">{order.customer_supplier_id || 'Unknown Customer'}</span>
                    <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-full ${
                      order.status === 'QUOTATION' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'PACKING' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mb-2">{order.order_id.substring(0, 8)}...</div>
                  <div className="text-sm font-bold text-on-surface-variant flex items-center justify-between mt-3">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                      {orderItemCount(order)} items
                    </span>
                    <span>{currency(orderTotal(order))}</span>
                  </div>
                  {order.status === 'DISPATCH' && (
                    <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-50 border border-green-100 rounded-md px-2 py-1 inline-block">
                      E-Way {order.eway_bill_status || 'PENDING'}
                    </div>
                  )}
                </div>
              ))}
              {orders.length === 0 && (
                <div className="p-8 text-center text-slate-400 font-medium">No sales orders found.</div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-2/3 bg-surface-container-lowest rounded-2xl material-3d-shadow p-6 border border-slate-200 overflow-y-auto">
            {pageError && (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50/70 p-3 text-sm text-red-700 font-semibold">
                {pageError}
              </div>
            )}

            {isNewForm ? (
              <form onSubmit={handleCreateOrder} className="flex flex-col gap-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 bg-primary-container text-white rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-primary">New Sales Quotation</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Client Initialization</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Customer ID (Auto-Fill)</label>
                    <input
                      type="text"
                      required
                      value={customerId}
                      onChange={e => {
                        setCustomerId(e.target.value.toUpperCase());
                        setPartyLookupError('');
                      }}
                      onBlur={() => lookupCustomer(customerId)}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Try: CUST-1001, CUST-1002, CUST-1003</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Customer / Enterprise Name</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Shipping Notes</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {partyInfo && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex justify-between items-center gap-3 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-widest font-black text-blue-700">Auto-Filled Customer Profile</p>
                        <p className="font-bold text-primary">{partyInfo.name}</p>
                        <p className="text-xs text-slate-600">{partyInfo.contactPerson} | {partyInfo.phone}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                        partyInfo.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                        partyInfo.riskLevel === 'MEDIUM' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
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
                    <button type="button" onClick={addProductRow} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:border-primary">
                      <span className="material-symbols-outlined text-[14px]">add</span> Add Item
                    </button>
                  </h3>

                  {products.map((line, index) => (
                    <div key={index} className="flex gap-2 items-end mb-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">SKU / Product Code</label>
                        <input type="text" required value={line.product_code} onChange={e => updateProductRow(index, 'product_code', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Qty</label>
                        <input type="number" min="1" required value={line.quantity} onChange={e => updateProductRow(index, 'quantity', Number(e.target.value || 0))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="w-32">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Unit Price</label>
                        <input type="number" min="0" step="0.01" required value={line.price} onChange={e => updateProductRow(index, 'price', Number(e.target.value || 0))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <button type="button" onClick={() => removeProductRow(index)} className="p-2 text-slate-400 hover:text-error bg-white border border-slate-200 rounded-lg mb-[1px]">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}

                  <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Order Subtotal:</span>
                    <span className="text-lg font-black text-primary">
                      {currency(products.reduce((acc, line) => acc + Number(line.price || 0) * Number(line.quantity || 0), 0))}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="primary-gradient text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-all">
                    Generate Quotation
                  </button>
                </div>
              </form>
            ) : selectedOrder ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-primary mb-1">{selectedOrder.customer_supplier_id}</h2>
                    <p className="text-sm text-slate-500 font-mono">ID: {selectedOrder.order_id}</p>
                    <p className="text-xs text-slate-400 mt-2">{new Date(selectedOrder.date).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full ${
                      selectedOrder.status === 'QUOTATION' ? 'bg-blue-100 text-blue-700' :
                      selectedOrder.status === 'PACKING' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {selectedOrder.status}
                    </span>
                    <p className="text-2xl font-black text-primary mt-4">{currency(orderTotal(selectedOrder))}</p>
                  </div>
                </div>

                <div className="flex-1 bg-slate-50 rounded-xl p-6 border border-slate-100 mb-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Manifest</h3>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-400">
                        <th className="pb-2">SKU</th>
                        <th className="pb-2 text-center">QTY</th>
                        <th className="pb-2 text-right">UNIT PRICE</th>
                        <th className="pb-2 text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.products.map((line, index) => (
                        <tr key={index} className="text-sm font-medium text-on-surface-variant">
                          <td className="py-3 font-mono text-xs">{line.product_code}</td>
                          <td className="py-3 text-center">{line.quantity}</td>
                          <td className="py-3 text-right">{currency(Number(line.price || 0))}</td>
                          <td className="py-3 text-right font-black text-primary">{currency(Number(line.price || 0) * Number(line.quantity || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedOrder.status === 'PACKING' && ['SYSTEM_ADMIN', 'LOGISTICS_COORDINATOR'].includes(currentRole || '') && (
                  <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-emerald-700 mb-3">Compliance Dispatch Console</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Invoice Number</label>
                        <input
                          value={dispatchForm.invoice_number}
                          onChange={e => setDispatchForm(prev => ({ ...prev, invoice_number: e.target.value.toUpperCase() }))}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          placeholder="INV-2026-0001"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Vehicle Number</label>
                        <input
                          value={dispatchForm.vehicle_number}
                          onChange={e => setDispatchForm(prev => ({ ...prev, vehicle_number: e.target.value.toUpperCase() }))}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          placeholder="TS09AB1234"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Transporter ID</label>
                        <input
                          value={dispatchForm.transporter_id}
                          onChange={e => setDispatchForm(prev => ({ ...prev, transporter_id: e.target.value.toUpperCase() }))}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          placeholder="TRN-001"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Distance (km)</label>
                        <input
                          type="number"
                          min="1"
                          value={dispatchForm.distance_km}
                          onChange={e => setDispatchForm(prev => ({ ...prev, distance_km: Number(e.target.value || 0) }))}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 w-full md:w-1/2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Transport Mode</label>
                      <select
                        value={dispatchForm.mode}
                        onChange={e => setDispatchForm(prev => ({ ...prev, mode: e.target.value as DispatchMode }))}
                        className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="ROAD">Road</option>
                        <option value="RAIL">Rail</option>
                        <option value="AIR">Air</option>
                        <option value="SHIP">Ship</option>
                      </select>
                    </div>

                    {dispatchError && (
                      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        {dispatchError}
                      </div>
                    )}

                    <div className="flex justify-end mt-4">
                      <button
                        type="button"
                        onClick={dispatchOrder}
                        disabled={dispatchSaving}
                        className="bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-500/30 hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {dispatchSaving ? 'Dispatching...' : 'Dispatch + Generate E-Way Bill'}
                      </button>
                    </div>
                  </div>
                )}
                {selectedOrder.status === 'DISPATCH' && (
                  <div className="mb-6 rounded-xl border border-green-100 bg-green-50/60 p-4 space-y-3">
                    <p className="text-xs uppercase tracking-widest font-black text-green-700">Automated Compliance Status</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white border border-green-100 p-3">
                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">E-Way Bill</p>
                        <p className="font-bold text-primary mt-1">{selectedOrder.eway_bill_status || 'PENDING'}</p>
                        {selectedOrder.eway_bill_number && <p className="text-xs text-slate-500 mt-1">No: {selectedOrder.eway_bill_number}</p>}
                        {selectedOrder.eway_bill_valid_upto && <p className="text-xs text-slate-500">Valid till: {new Date(selectedOrder.eway_bill_valid_upto).toLocaleString()}</p>}
                      </div>
                      <div className="rounded-lg bg-white border border-green-100 p-3">
                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Transport</p>
                        <p className="font-bold text-primary mt-1">{selectedOrder.transport_details?.vehicle_number || 'N/A'} | {selectedOrder.transport_details?.mode || 'ROAD'}</p>
                        <p className="text-xs text-slate-500 mt-1">{selectedOrder.transport_details?.transporter_id || 'TRN-001'} | {selectedOrder.transport_details?.distance_km || 0} km</p>
                      </div>
                    </div>

                    {selectedOrder.compliance_meta?.taxSummary && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-lg bg-white border border-green-100 p-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Taxable Value</p>
                          <p className="font-black text-primary mt-1">{currency(Number(selectedOrder.compliance_meta.taxSummary.taxableValue || 0))}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-green-100 p-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">GST Value</p>
                          <p className="font-black text-primary mt-1">{currency(Number(selectedOrder.compliance_meta.taxSummary.gstValue || 0))}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-green-100 p-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Invoice Value</p>
                          <p className="font-black text-primary mt-1">{currency(Number(selectedOrder.compliance_meta.taxSummary.invoiceValue || 0))}</p>
                        </div>
                      </div>
                    )}

                    {selectedOrder.compliance_meta?.filingStatus && (
                      <p className="text-xs text-slate-600">
                        Filing Health: <span className="font-bold text-primary">{selectedOrder.compliance_meta.filingStatus}</span>
                        {selectedOrder.compliance_meta.filingReason ? ` - ${selectedOrder.compliance_meta.filingReason}` : ''}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-auto">
                  {selectedOrder.status === 'QUOTATION' && currentRole !== 'LOGISTICS_COORDINATOR' && (
                    <button onClick={() => advanceToPacking(selectedOrder.order_id)} className="bg-orange-100 text-orange-700 px-6 py-2.5 rounded-xl font-bold hover:bg-orange-200 transition-colors">
                      Advance to Packing
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[64px] mb-4 opacity-20">point_of_sale</span>
                <p className="font-medium">Select an order or create a new quotation</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
