import { useState, useEffect } from 'react';
import SideNavBar from '../components/layout/SideNavBar';
import TopNavBar from '../components/layout/TopNavBar';
import { API_URL as API } from '../config/api';

const SettingsPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('SALES_EXECUTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
         setError('Only SYSTEM_ADMIN can view users');
      }
    } catch {
       setError('Failed to load users');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
      });
      
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to create user');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await fetch(`${API}/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchUsers();
    } catch {}
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await fetch(`${API}/users/${id}/role`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      fetchUsers();
    } catch {}
  };

  const currentRole = localStorage.getItem('role');

  if (currentRole !== 'SYSTEM_ADMIN') {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex">
        <SideNavBar />
        <div className="flex-1 ml-64 flex flex-col">
          <TopNavBar />
          <div className="p-8 flex items-center justify-center flex-1">
            <h2 className="text-xl text-error font-bold">Access Denied: SYSTEM_ADMIN privileges required.</h2>
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
        <main className="flex-1 overflow-y-auto pt-24 p-4 md:p-8 bg-[#f8f9fa] dark:bg-slate-900">
          <div className="max-w-6xl mx-auto space-y-6">
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-black text-primary tracking-tight">Staff Management</h1>
                <p className="text-sm font-medium text-on-surface-variant flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                  Enterprise RBAC Console
                </p>
              </div>
            </div>

            {error && <div className="text-error bg-error-container p-3 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Add User Form */}
              <div className="col-span-1 lg:col-span-1">
                <form onSubmit={handleCreate} className="bg-surface-container-lowest p-6 rounded-2xl material-3d-shadow flex flex-col gap-4 border border-slate-200">
                  <h3 className="font-bold text-primary flex items-center gap-2 border-b border-slate-100 pb-3">
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Onboard Employee
                  </h3>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Username</label>
                    <input type="text" required value={newUsername} onChange={e => setNewUsername(e.target.value)}
                           className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Temporary Password</label>
                    <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                           className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Professional Designation</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)}
                            className="w-full mt-1 bg-surface border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="SYSTEM_ADMIN">System Admin</option>
                      <option value="INVENTORY_MANAGER">Inventory Manager</option>
                      <option value="SALES_EXECUTIVE">Sales Executive</option>
                      <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                      <option value="PRODUCTION_TECHNICIAN">Production Technician</option>
                      <option value="LOGISTICS_COORDINATOR">Logistics Coordinator</option>
                    </select>
                  </div>

                  <button type="submit" disabled={loading} className="mt-4 primary-gradient text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
                    <span>Generate Credentials</span>
                  </button>
                </form>
              </div>

              {/* User List */}
              <div className="col-span-1 lg:col-span-2">
                <div className="bg-surface-container-lowest rounded-2xl material-3d-shadow overflow-hidden border border-slate-200">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-widest font-bold">
                        <th className="px-6 py-4">Employee ID / Name</th>
                        <th className="px-6 py-4">Designation</th>
                        <th className="px-6 py-4 text-center">Enrolled</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                                 {u.username[0].toUpperCase()}
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-primary">{u.username}</p>
                                 <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.id}</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {u.username === 'admin' ? (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                {u.role.replaceAll('_', ' ')}
                              </span>
                            ) : (
                              <select 
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                              >
                                <option value="SYSTEM_ADMIN">System Admin</option>
                                <option value="INVENTORY_MANAGER">Inventory Manager</option>
                                <option value="SALES_EXECUTIVE">Sales Executive</option>
                                <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                                <option value="PRODUCTION_TECHNICIAN">Production Technician</option>
                                <option value="LOGISTICS_COORDINATOR">Logistics Coordinator</option>
                              </select>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-xs text-slate-500 font-medium">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                             {u.username !== 'admin' && (
                               <button onClick={() => handleDelete(u.id)} className="p-2 text-error hover:bg-error-container hover:text-error rounded-lg transition-colors">
                                 <span className="material-symbols-outlined text-[20px]">person_remove</span>
                               </button>
                             )}
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-400">Loading directory...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
