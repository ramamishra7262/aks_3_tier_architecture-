import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', price: '', description: '', stock: '' });

  useEffect(() => { axios.get('/api/products').then(r => { setProducts(r.data); setLoading(false); }); }, []);

  const create = async (e) => {
    e.preventDefault();
    const { data } = await axios.post('/api/products', form);
    setProducts(prev => [data, ...prev]);
    setForm({ name: '', price: '', description: '', stock: '' });
  };

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div className="page">
      <h1>Products</h1>
      <form className="create-form" onSubmit={create}>
        <input placeholder="Name"        value={form.name}        onChange={e => setForm({...form, name: e.target.value})} required />
        <input placeholder="Price"       value={form.price}       onChange={e => setForm({...form, price: e.target.value})} type="number" step="0.01" required />
        <input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <input placeholder="Stock"       value={form.stock}       onChange={e => setForm({...form, stock: e.target.value})} type="number" />
        <button type="submit">Add Product</button>
      </form>
      <div className="card-grid">
        {products.map(p => (
          <div key={p.id} className="card">
            <h3>{p.name}</h3>
            <p className="price">${parseFloat(p.price).toFixed(2)}</p>
            <p className="desc">{p.description}</p>
            <span className="badge blue">Stock: {p.stock_quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
