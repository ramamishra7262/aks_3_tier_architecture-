import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get('/api/users/count'),
      axios.get('/api/products/count'),
      axios.get('/api/orders/count'),
    ]).then(([users, products, orders]) => {
      setStats({ users: users.data.count, products: products.data.count, orders: orders.data.count });
    }).catch(() => setStats({ users: '-', products: '-', orders: '-' }));
  }, []);

  return (
    <div className="dashboard">
      <h1>System Dashboard</h1>
      <div className="stat-cards">
        {[
          { label: 'Users',    value: stats?.users,    icon: '👥' },
          { label: 'Products', value: stats?.products, icon: '📦' },
          { label: 'Orders',   value: stats?.orders,   icon: '🛒' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon">{icon}</div>
            <div className="stat-value">{value ?? '...'}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>
      <div className="arch-info">
        <h2>Architecture</h2>
        <div className="tiers">
          <div className="tier tier-1">Tier 1: Frontend (React + Nginx)</div>
          <div className="tier-arrow">↕</div>
          <div className="tier tier-2">Tier 2: Microservices (User · Product · Order)</div>
          <div className="tier-arrow">↕</div>
          <div className="tier tier-3">Tier 3: Database (PostgreSQL · Redis)</div>
        </div>
      </div>
    </div>
  );
}
