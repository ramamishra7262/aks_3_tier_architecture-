const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { pool, redis } = req.app.locals;
    const cached = await redis.get('products:all').catch(() => null);
    if (cached) return res.json(JSON.parse(cached));
    const r = await pool.query('SELECT * FROM products WHERE active=true ORDER BY created_at DESC LIMIT 100');
    await redis.setEx('products:all', 120, JSON.stringify(r.rows)).catch(() => {});
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { pool } = req.app.locals;
    const r = await pool.query('SELECT * FROM products WHERE id=$1 AND active=true', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.post('/',
  [body('name').trim().notEmpty(), body('price').isFloat({ min: 0 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { pool, redis } = req.app.locals;
      const { name, description, price, stock_quantity = 0, category } = req.body;
      const r = await pool.query(
        'INSERT INTO products (name, description, price, stock_quantity, category) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [name, description, price, stock_quantity, category]
      );
      await redis.del('products:all').catch(() => {});
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  }
);

router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { pool, redis } = req.app.locals;
    const { quantity } = req.body;
    const r = await pool.query(
      'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id=$2 RETURNING *',
      [quantity, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Product not found' });
    await redis.del('products:all').catch(() => {});
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { pool, redis } = req.app.locals;
    await pool.query('UPDATE products SET active=false WHERE id=$1', [req.params.id]);
    await redis.del('products:all').catch(() => {});
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
