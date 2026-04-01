import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';

const StubPage = ({ title }: { title: string }) => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex">
      <SideNavBar />
      <div className="flex-1 ml-64 flex flex-col">
        <TopNavBar />
        <main className="flex-1 pt-24 px-8 pb-12 flex flex-col items-center justify-center text-center">
          <div className="bg-surface-container-low p-12 rounded-3xl border border-slate-200 material-3d-shadow w-full max-w-2xl">
            <span className="material-symbols-outlined text-focus-ring/50 text-[80px] mb-6">construction</span>
            <h2 className="text-3xl font-extrabold text-primary mb-2">{title} Module</h2>
            <p className="text-on-surface-variant font-medium">This module is currently under active development. Check back soon for the fully interactive {title} forms and data tables.</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StubPage;
