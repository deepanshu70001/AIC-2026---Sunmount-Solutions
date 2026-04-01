import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import InventoryPage from './pages/InventoryPage';
import PurchasesPage from './pages/PurchasesPage';
import ManufacturingPage from './pages/ManufacturingPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import SalesPage from './pages/SalesPage';
import Login from './pages/Login';
import AIChatWidget from './components/chat/AIChatWidget';

function App() {
  const [auth, setAuth] = useState<{ token: string | null; role: string | null; username: string | null }>({
    token: localStorage.getItem('token'),
    role: localStorage.getItem('role'),
    username: localStorage.getItem('username'),
  });

  // Handle cross-tab logout syncing
  useEffect(() => {
    const handleStorage = () => {
      setAuth({
        token: localStorage.getItem('token'),
        role: localStorage.getItem('role'),
        username: localStorage.getItem('username'),
      });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!auth.token) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login setAuth={setAuth} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/sales" element={<SalesPage />} />
        
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/manufacturing" element={<ManufacturingPage />} />
        <Route path="/reports" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <AIChatWidget />
    </Router>
  );
}

export default App;
