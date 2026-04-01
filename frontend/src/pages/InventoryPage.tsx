import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';

interface Product {
  product_code: string;
  name: string;
  description: string;
  weight: number;
  price: number;
  quantity: number;
  last_updated: string;
}

const API = 'http://localhost:3001/api';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const InventoryPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ product_code: '', name: '', description: '', weight: 0, price: 0, quantity: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/products`, { headers: authHeaders() });
      if (res.ok) setProducts(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/products`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(formData) });
    fetchProducts();
    setShowForm(false);
    setIsEditing(false);
    setFormData({ product_code: '', name: '', description: '', weight: 0, price: 0, quantity: 0 });
  };

  const handleDelete = async (code: string) => {
    if (!window.confirm(`Delete product ${code}?`)) return;
    await fetch(`${API}/products/${code}`, { method: 'DELETE', headers: authHeaders() });
    setSelectedProduct(null);
    fetchProducts();
  };

  const startEdit = (p: Product) => {
    setFormData({ product_code: p.product_code, name: p.name, description: p.description || '', weight: p.weight || 0, price: p.price, quantity: p.quantity });
    setIsEditing(true);
    setShowForm(true);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.product_code.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = products.reduce((s, p) => s + p.price * p.quantity, 0);
  const currentRole = localStorage.getItem('role');

  return (
    <div className="bg-surface text-on-surface min-h-screen flex">
      <SideNavBar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <TopNavBar />
        <main className="flex-1 pt-16 flex overflow-hidden">
          {/* Master List */}
          <div className="w-1/3 border-r border-slate-200 bg-surface-container-lowest flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-primary">Inventory</h2>
                {['SYSTEM_ADMIN', 'INVENTORY_MANAGER'].includes(currentRole || '') && (
                  <button onClick={() => { setShowForm(true); setIsEditing(false); setFormData({ product_code: '', name: '', description: '', weight: 0, price: 0, quantity: 0 }); }}
                    className="bg-primary text-white p-2 rounded-lg hover:bg-primary-fixed transition-colors shadow-md">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input type="text" className="w-full bg-surface-container-low border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                  placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{products.length} products</span>
                <span className="font-bold text-primary">{formatCurrency(totalValue)} total</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && <div className="p-8 text-center text-slate-400">Loading products...</div>}
              {!loading && filteredProducts.length === 0 && <div className="p-8 text-center text-slate-400">No products found</div>}
              {filteredProducts.map(p => (
                <button key={p.product_code} onClick={() => { setSelectedProduct(p); setShowForm(false); }}
                  className={`w-full text-left p-3 rounded-lg transition-all flex justify-between items-center ${
                    selectedProduct?.product_code === p.product_code ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-100 text-on-surface-variant'
                  }`}>
                  <div>
                    <h4 className={`font-bold text-sm ${selectedProduct?.product_code === p.product_code ? 'text-white' : 'text-primary'}`}>{p.name}</h4>
                    <p className={`text-xs ${selectedProduct?.product_code === p.product_code ? 'text-primary-fixed' : 'text-slate-500'}`}>{p.product_code}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${selectedProduct?.product_code === p.product_code ? 'text-white' : 'text-primary'}`}>{formatCurrency(p.price)}</p>
                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                      p.quantity < 5 ? 'bg-error text-white' : p.quantity < 15 ? 'bg-orange-100 text-orange-700' : 'bg-secondary-container text-on-secondary-container'
                    }`}>{p.quantity} in stock</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail / Form Panel */}
          <div className="w-2/3 bg-background flex flex-col h-full overflow-y-auto">
            {showForm ? (
              <form onSubmit={handleSave} className="p-8 max-w-2xl space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 bg-primary-container text-white rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined">{isEditing ? 'edit' : 'add_circle'}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-primary">{isEditing ? 'Edit Product' : 'New Product'}</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Product Registration</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Product Code</label>
                    <input type="text" required disabled={isEditing} value={formData.product_code}
                      onChange={e => setFormData({ ...formData, product_code: e.target.value })}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Product Name</label>
                    <input type="text" required value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Description</label>
                    <input type="text" value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Weight (kg)</label>
                    <input type="number" step="0.01" value={formData.weight}
                      onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Price (₹)</label>
                    <input type="number" step="0.01" required value={formData.price}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Quantity</label>
                    <input type="number" required value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                      className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="primary-gradient text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-all">
                    {isEditing ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            ) : selectedProduct ? (
              <div className="p-8 max-w-3xl">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-black text-primary">{selectedProduct.name}</h1>
                      <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded">{selectedProduct.product_code}</span>
                    </div>
                    <p className="text-on-surface-variant">{selectedProduct.description || 'No description'}</p>
                  </div>
                  {['SYSTEM_ADMIN', 'INVENTORY_MANAGER'].includes(currentRole || '') && (
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(selectedProduct)} className="p-2 bg-surface-container-high hover:bg-slate-300 rounded-lg text-primary transition-colors flex items-center gap-1 text-sm font-semibold">
                        <span className="material-symbols-outlined text-[18px]">edit</span> Edit
                      </button>
                      <button onClick={() => handleDelete(selectedProduct.product_code)} className="p-2 bg-error-container hover:bg-error/20 text-error rounded-lg flex items-center gap-1 text-sm font-semibold transition-colors">
                        <span className="material-symbols-outlined text-[18px]">delete</span> Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow border border-slate-100">
                    <p className="text-sm font-semibold text-slate-500 mb-1">Unit Price</p>
                    <p className="text-2xl font-black text-primary">{formatCurrency(selectedProduct.price)}</p>
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow border border-slate-100">
                    <p className="text-sm font-semibold text-slate-500 mb-1">Available Stock</p>
                    <p className="text-2xl font-black text-primary">{selectedProduct.quantity} units</p>
                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                      selectedProduct.quantity < 5 ? 'bg-error text-white' : selectedProduct.quantity < 15 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>{selectedProduct.quantity < 5 ? 'CRITICAL' : selectedProduct.quantity < 15 ? 'LOW STOCK' : 'HEALTHY'}</span>
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow border border-slate-100">
                    <p className="text-sm font-semibold text-slate-500 mb-1">Total Value</p>
                    <p className="text-2xl font-black text-primary">{formatCurrency(selectedProduct.price * selectedProduct.quantity)}</p>
                  </div>
                </div>
                <div className="bg-surface-container-lowest rounded-xl material-3d-shadow overflow-hidden border border-slate-100">
                  <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-primary">Item Details</h3></div>
                  <div className="p-4 grid grid-cols-2 gap-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Weight</p>
                      <p className="text-sm font-medium text-primary mt-1">{selectedProduct.weight || '—'} kg</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Updated</p>
                      <p className="text-sm font-medium text-primary mt-1">{new Date(selectedProduct.last_updated).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="material-symbols-outlined text-6xl mb-4 opacity-50">inventory_2</span>
                <p className="text-lg font-medium text-slate-500">Select an item from the list to view details</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default InventoryPage;
