

const RecentActivityFeed = () => {
  return (
    <div className="col-span-12 lg:col-span-4">
      <h3 className="text-xl font-bold text-primary mb-6">Recent Activity</h3>
      <div className="bg-surface-container-lowest rounded-xl material-3d-shadow p-6">
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container relative z-10">
                <span className="material-symbols-outlined text-lg">local_shipping</span>
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-100"></div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">14:22 PM</p>
              <p className="text-sm font-bold text-primary mt-1">Order #PO-9912 Dispatched</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Carrier: Logistics Plus • Status: In Transit</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary relative z-10">
                <span className="material-symbols-outlined text-lg">edit</span>
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-100"></div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">11:05 AM</p>
              <p className="text-sm font-bold text-primary mt-1">Inventory Adjusted</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Alex Sterling adjusted SKU: CPU-7782-X (-4 units)</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-error relative z-10">
                <span className="material-symbols-outlined text-lg">inventory_2</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">09:30 AM</p>
              <p className="text-sm font-bold text-primary mt-1">Stock Level Alert</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Item: Titanium Chassis B-4 reached critical low</p>
            </div>
          </div>
        </div>
        <button className="w-full mt-8 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-2">
          <span>Show full audit log</span>
          <span className="material-symbols-outlined text-lg">arrow_right_alt</span>
        </button>
      </div>
    </div>
  );
};

export default RecentActivityFeed;
