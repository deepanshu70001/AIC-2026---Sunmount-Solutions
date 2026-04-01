import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL as API } from '../config/api';

const Login = ({ setAuth }: { setAuth: (data: any) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('username', data.username);
        setAuth({ token: data.token, role: data.role, username: data.username });
        navigate('/dashboard');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection failed. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #172434 0%, transparent 50%)' }}></div>
      
      <div className="w-full max-w-sm z-10 bg-surface-container-low p-8 rounded-3xl material-3d-shadow border border-slate-200">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center material-3d-shadow mb-4">
            <span className="material-symbols-outlined text-[32px]">inventory_2</span>
          </div>
          <h1 className="text-2xl font-black text-primary text-center leading-none">Inventory Pro</h1>
          <p className="text-on-surface-variant text-sm font-medium mt-1">Enterprise Management</p>
        </div>

        {error && (
          <div className="mb-4 bg-error-container text-error px-4 py-3 rounded-xl text-sm font-medium flex gap-2 items-center">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1">Username</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              placeholder="e.g. admin"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-2 primary-gradient text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">refresh</span>
            ) : (
              <>
                <span>Secure Login</span>
                <span className="material-symbols-outlined text-[18px]">lock</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
