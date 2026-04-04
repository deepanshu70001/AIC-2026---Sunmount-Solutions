import { NavLink } from 'react-router-dom';

const SideNavBar = () => {
  const role = localStorage.getItem('role') || 'SYSTEM_ADMIN';

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const navClass = ({ isActive }: { isActive: boolean }) => 
    `flex items-center gap-3 px-4 py-3 rounded-lg font-sans text-[13px] font-medium leading-none transition-all duration-200 ease-in-out ${
      isActive 
        ? 'bg-[#e7e8e9] dark:bg-slate-800 text-[#2D3A4A] dark:text-white shadow-inner' 
        : 'text-slate-600 dark:text-slate-400 hover:bg-[#e7e8e9] dark:hover:bg-slate-800/50 hover:text-[#2D3A4A] dark:hover:text-white'
    }`;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-40 bg-[#f3f4f5] dark:bg-slate-950 flex flex-col p-4 gap-y-2 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] overflow-y-auto">
      <div className="flex items-center gap-3 px-3 py-6 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-white">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
        </div>
        <div>
          <h1 className="text-lg font-black text-[#2D3A4A] dark:text-white leading-none">Inventory Pro</h1>
          <p className="text-[11px] text-slate-500 font-medium tracking-wide mt-1 bg-white/50 px-2 py-0.5 rounded-full uppercase border border-slate-200">
            {role.replaceAll('_', ' ')}
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        <NavLink to="/dashboard" className={navClass}>
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          <span>Dashboard</span>
        </NavLink>

        {['SYSTEM_ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_TECHNICIAN'].includes(role) && (
          <NavLink to="/inventory" className={navClass}>
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            <span>Inventory</span>
          </NavLink>
        )}

        {['SYSTEM_ADMIN', 'SALES_EXECUTIVE', 'LOGISTICS_COORDINATOR'].includes(role) && (
          <NavLink to="/sales" className={navClass}>
            <span className="material-symbols-outlined text-[20px]">payments</span>
            <span>Sales Operations</span>
          </NavLink>
        )}

        {['SYSTEM_ADMIN', 'PROCUREMENT_OFFICER'].includes(role) && (
          <NavLink to="/purchases" className={navClass}>
            <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
            <span>Purchases</span>
          </NavLink>
        )}

        {['SYSTEM_ADMIN', 'PRODUCTION_TECHNICIAN'].includes(role) && (
          <NavLink to="/manufacturing" className={navClass}>
            <span className="material-symbols-outlined text-[20px]">factory</span>
            <span>Manufacturing WIP</span>
          </NavLink>
        )}

        {['SYSTEM_ADMIN', 'INVENTORY_MANAGER'].includes(role) && (
          <NavLink to="/sync" className={navClass}>
            <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
            <span>Distributed Sync</span>
          </NavLink>
        )}

        {['SYSTEM_ADMIN', 'SALES_EXECUTIVE', 'INVENTORY_MANAGER', 'PROCUREMENT_OFFICER', 'PRODUCTION_TECHNICIAN'].includes(role) && (
          <NavLink to="/reports" className={navClass}>
            <span className="material-symbols-outlined text-[20px]">history</span>
            <span>Order History</span>
          </NavLink>
        )}

        {role === 'SYSTEM_ADMIN' && (
          <NavLink to="/settings" className={navClass}>
            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            <span>Staff Management</span>
          </NavLink>
        )}
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button 
          onClick={handleLogout}
          className="w-full bg-surface-container-low text-error border border-error/20 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-error-container transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Secure Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default SideNavBar;
