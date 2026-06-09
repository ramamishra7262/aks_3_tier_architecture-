-- ── Seed Data ────────────────────────────────────────────────────────────────
-- Admin user (password: Admin@123)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User',   'admin@example.com',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewHMtMGxKsFe6JiO', 'admin'),
  ('Jane Doe',     'jane@example.com',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewHMtMGxKsFe6JiO', 'user'),
  ('John Smith',   'john@example.com',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewHMtMGxKsFe6JiO', 'user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO products (name, description, price, stock_quantity, category, sku) VALUES
  ('Laptop Pro 15',     'High-performance laptop for professionals', 1299.99, 50, 'Electronics', 'LAPTOP-PRO-15'),
  ('Wireless Mouse',    'Ergonomic wireless mouse, 12-month battery', 39.99,  200, 'Electronics', 'WL-MOUSE-01'),
  ('Mechanical Keyboard','RGB backlit mechanical keyboard',            89.99,  150, 'Electronics', 'MECH-KB-01'),
  ('Monitor 27" 4K',    '4K IPS display, 144Hz, HDR400',             449.99,  30, 'Electronics', 'MON-27-4K'),
  ('USB-C Hub 7-in-1',  'Multi-port hub with PD charging',            29.99,  300, 'Accessories', 'USB-HUB-7'),
  ('Desk Lamp LED',     'Adjustable LED desk lamp, USB powered',       24.99,  100, 'Accessories', 'DESK-LAMP-01')
ON CONFLICT (sku) DO NOTHING;
