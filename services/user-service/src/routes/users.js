const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// GET /api/users — list all (no passwords)
router.get('/', async (req, res, next) => {
  try {
    const { pool, redis } = req.app.locals;
    const cacheKey = 'users:all';
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) return res.json(JSON.parse(cached));

    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 100'
    );
    await redis.setEx(cacheKey, 60, JSON.stringify(result.rows)).catch(() => {});
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { pool } = req.app.locals;
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/users — create user
router.post('/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['user', 'admin']),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { pool, redis } = req.app.locals;
      const { name, email, password, role = 'user' } = req.body;
      const hashed = await bcrypt.hash(password, 12);
      const result = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, created_at',
        [name, email, hashed, role]
      );
      await redis.del('users:all').catch(() => {});
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
      next(err);
    }
  }
);

// DELETE /api/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { pool, redis } = req.app.locals;
    const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    await redis.del('users:all').catch(() => {});
    res.json({ message: 'User deleted', id: result.rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
