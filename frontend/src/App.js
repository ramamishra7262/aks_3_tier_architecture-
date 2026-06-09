import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Users from './pages/Users';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  const [health, setHealth] = useState({ api: 'checking...', db: 'checking...' });

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setHealth(d))
      .catch(() => setHealth({ api: 'error', db: 'error' }));
  }, []);

  return (
    <Router>
      <div className="app">
        <header className="navbar">
          <div className="brand">🚀 AKS 3-Tier App</div>
          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/products">Products</Link>
            <Link to="/orders">Orders</Link>
            <Link to="/users">Users</Link>
          </nav>
          <div className="health-badges">
            <span className={`badge ${health.api === 'ok' ? 'green' : 'red'}`}>API: {health.api}</span>
            <span className={`badge ${health.db === 'ok' ? 'green' : 'red'}`}>DB: {health.db}</span>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/products"  element={<Products />} />
            <Route path="/orders"    element={<Orders />} />
            <Route path="/users"     element={<Users />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
export default App;
