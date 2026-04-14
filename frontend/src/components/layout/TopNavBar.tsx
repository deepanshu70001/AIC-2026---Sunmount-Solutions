
import { useTheme } from '../../context/ThemeContext';

const TopNavBar = () => {
  const { theme, toggleTheme, toggleSidebar } = useTheme();
  const username = localStorage.getItem('username') || 'User';
  const role = localStorage.getItem('role') || 'STAFF';

  const roleLabel: Record<string, string> = {
    SYSTEM_ADMIN: 'System Administrator',
    INVENTORY_MANAGER: 'Inventory Manager',
    SALES_EXECUTIVE: 'Sales Executive',
    PROCUREMENT_OFFICER: 'Procurement Officer',
    PRODUCTION_TECHNICIAN: 'Production Technician',
    LOGISTICS_COORDINATOR: 'Logistics Coordinator',
  };

  return (
    <header className="fixed top-0 left-0 lg:left-64 flex-1 right-0 z-40 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 flex justify-between items-center px-4 lg:px-8 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={toggleSidebar} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
          <input className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400" placeholder="Search inventory, SKUs, or orders..." type="text"/>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleTheme} 
          className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <span className="material-symbols-outlined">
            {theme === 'light' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>
        <button className="p-2 hidden sm:block text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white dark:border-slate-800"></span>
        </button>
        <button className="p-2 hidden sm:block text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <span className="material-symbols-outlined">apps</span>
        </button>
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
            {username[0].toUpperCase()}
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-primary leading-tight capitalize">{username}</p>
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{roleLabel[role] || role}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavBar;
