

const ActiveStockTable = () => {
  return (
    <div className="col-span-12 lg:col-span-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-primary">Critical Low Stock</h3>
        <a className="text-primary text-sm font-bold underline underline-offset-4" href="#">Reorder All</a>
      </div>
      <div className="bg-surface-container-lowest rounded-xl material-3d-shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-widest font-bold">
              <th className="px-6 py-4">Item Details</th>
              <th className="px-6 py-4 text-center">SKU</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Current Level</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            <tr className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">memory</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">ARM-v9 Logic Controller</p>
                    <p className="text-xs text-on-surface-variant">Core Processing Units</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-5 text-center font-mono text-xs text-on-surface-variant">CPU-7782-X</td>
              <td className="px-6 py-5 text-center">
                <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-black px-2 py-1 rounded-full">LOW STOCK</span>
              </td>
              <td className="px-6 py-5 text-right">
                <p className="text-sm font-black text-error">12 units</p>
                <p className="text-[10px] text-slate-400">Min: 50 units</p>
              </td>
              <td className="px-6 py-5 text-right">
                <button className="p-2 text-primary hover:bg-primary-fixed rounded-lg transition-colors">
                  <span className="material-symbols-outlined">shopping_cart_checkout</span>
                </button>
              </td>
            </tr>
            <tr className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">precision_manufacturing</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">Titanium Chassis B-4</p>
                    <p className="text-xs text-on-surface-variant">Structural Frameworks</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-5 text-center font-mono text-xs text-on-surface-variant">FRM-0091-T</td>
              <td className="px-6 py-5 text-center">
                <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-black px-2 py-1 rounded-full">LOW STOCK</span>
              </td>
              <td className="px-6 py-5 text-right">
                <p className="text-sm font-black text-error">3 units</p>
                <p className="text-[10px] text-slate-400">Min: 20 units</p>
              </td>
              <td className="px-6 py-5 text-right">
                <button className="p-2 text-primary hover:bg-primary-fixed rounded-lg transition-colors">
                  <span className="material-symbols-outlined">shopping_cart_checkout</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActiveStockTable;
