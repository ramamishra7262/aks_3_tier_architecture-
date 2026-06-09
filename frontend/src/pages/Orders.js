import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { axios.get('/api/orders').then(r => { setOrders(r.data); setLoading(false); }); }, []);

  const statusColor = (s) => ({ pending: 'orange', confirmed: 'blue', shipped: 'purple', delivered: 'green', cancelled: 'red' }[s] || 'grey');

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="page">
      <h1>Orders</h1>
      <div className="card-grid">
        {orders.map(o => (
          <div key={o.id} className="card">
            <div className="card-header">
              <span>Order #{o.id}</span>
              <span className="badge" style={{background: statusColor(o.status)}}>{o.status}</span>
            </div>
            <p>User: {o.user_id} · Total: <strong>${parseFloat(o.total_amount).toFixed(2)}</strong></p>
            <p className="date">{new Date(o.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
