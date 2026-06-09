const express = require('express');
const axios   = require('axios');
const { body, validationResult } = require('express-validator');
const router  = express.Router();

const ORDER_STATUSES = ['pending','confirmed','shipped','delivered','cancelled'];

router.get('/', async (req, res, next) => {
  try {
    const { pool } = req.app.locals;
    const { user_id, status, limit = 50 } = req.query;
    let q = 'SELECT o.*, array_agg(json_build_object(\'product_id\',oi.product_id,\'quantity\',oi.quantity,\'unit_price\',oi.unit_price)) AS items FROM orders o LEFT JOIN order_items oi ON o.id=oi.order_id';
    const params = [];
    const conditions = [];
    if (user_id)  { params.push(user_id);  conditions.push(`o.user_id=$${params.length}`); }
    if (status)   { params.push(status);   conditions.push(`o.status=$${params.length}`); }
    if (conditions.length) q += ' WHERE ' + conditions.join(' AND ');
    q += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { pool } = req.app.locals;
    const r = await pool.query(
      'SELECT o.*, array_agg(json_build_object(\'product_id\',oi.product_id,\'quantity\',oi.quantity,\'unit_price\',oi.unit_price)) AS items FROM orders o LEFT JOIN order_items oi ON o.id=oi.order_id WHERE o.id=$1 GROUP BY o.id',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.post('/',
  [body('user_id').isInt(), body('items').isArray({ min: 1 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const client = await req.app.locals.pool.connect();
    try {
      await client.query('BEGIN');
      const { user_id, items, shipping_address } = req.body;

      // Validate products and calculate total
      let total = 0;
      const enriched = [];
      for (const item of items) {
        const pr = await client.query('SELECT price, stock_quantity FROM products WHERE id=$1 AND active=true FOR UPDATE', [item.product_id]);
        if (!pr.rows.length) throw Object.assign(new Error(`Product ${item.product_id} not found`), { status: 404 });
        if (pr.rows[0].stock_quantity < item.quantity) throw Object.assign(new Error(`Insufficient stock for product ${item.product_id}`), { status: 422 });
        enriched.push({ ...item, unit_price: pr.rows[0].price });
        total += pr.rows[0].price * item.quantity;
      }

      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, shipping_address) VALUES ($1,$2,$3) RETURNING *',
        [user_id, total, shipping_address]
      );
      const orderId = orderResult.rows[0].id;

      for (const item of enriched) {
        await client.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)', [orderId, item.product_id, item.quantity, item.unit_price]);
        await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id=$2', [item.quantity, item.product_id]);
      }

      await client.query('COMMIT');
      await req.app.locals.redis.del('products:all').catch(() => {});
      res.status(201).json({ ...orderResult.rows[0], items: enriched });
    } catch (err) { await client.query('ROLLBACK'); next(err); }
    finally { client.release(); }
  }
);

router.patch('/:id/status',
  [body('status').isIn(ORDER_STATUSES)],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { pool } = req.app.locals;
      const r = await pool.query(
        'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
