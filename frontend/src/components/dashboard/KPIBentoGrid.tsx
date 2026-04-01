

const KPIBentoGrid = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* KPI 1 */}
      <div className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow flex flex-col justify-between group">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-primary-fixed rounded-lg text-primary">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <span className="text-secondary text-xs font-bold bg-secondary-container px-2 py-1 rounded-full">+12.5%</span>
        </div>
        <div>
          <p className="text-sm font-medium text-on-surface-variant">Total Stock Value</p>
          <p className="text-2xl font-black text-primary mt-1">₹1,284,590.00</p>
        </div>
      </div>
      {/* KPI 2 */}
      <div className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow flex flex-col justify-between border-l-4 border-secondary">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-secondary-container rounded-lg text-on-secondary-container">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <span className="text-error text-xs font-bold bg-error-container px-2 py-1 rounded-full">2 Critical</span>
        </div>
        <div>
          <p className="text-sm font-medium text-on-surface-variant">Low Stock Alerts</p>
          <p className="text-2xl font-black text-primary mt-1">14 items</p>
        </div>
      </div>
      {/* KPI 3 */}
      <div className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-surface-container-highest rounded-lg text-primary">
            <span className="material-symbols-outlined">pending_actions</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-on-surface-variant">Pending Orders</p>
          <p className="text-2xl font-black text-primary mt-1">42 orders</p>
        </div>
      </div>
      {/* KPI 4 */}
      <div className="bg-surface-container-lowest p-6 rounded-xl material-3d-shadow flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-primary rounded-lg text-white">
            <span className="material-symbols-outlined">conveyor_belt</span>
          </div>
          <span className="text-primary text-xs font-bold bg-primary-fixed px-2 py-1 rounded-full">Active</span>
        </div>
        <div>
          <p className="text-sm font-medium text-on-surface-variant">Production Batches</p>
          <p className="text-2xl font-black text-primary mt-1">8 Runs</p>
        </div>
      </div>
    </div>
  );
};

export default KPIBentoGrid;
