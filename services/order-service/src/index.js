require('dotenv').config();
const express  = require('express');
const helmet   = require('helmet');
const morgan   = require('morgan');
const cors     = require('cors');
const { Pool } = require('pg');
const redis    = require('redis');
const client   = require('prom-client');
const ordersRouter = require('./routes/orders');

const app  = express();
const PORT = process.env.PORT || 3003;

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres', port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appdb', user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword', max: 10,
});
const redisClient = redis.createClient({ socket: { host: process.env.REDIS_HOST || 'redis', port: 6379 } });
redisClient.connect().catch(e => console.error('Redis:', e));
app.locals.pool  = pool;
app.locals.redis = redisClient;
app.locals.productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';

app.use(helmet()); app.use(cors()); app.use(express.json()); app.use(morgan('combined'));
app.use('/api/orders', ordersRouter);

app.get('/health', async (req, res) => {
  let db = 'ok'; try { await pool.query('SELECT 1'); } catch { db = 'error'; }
  res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'error', service: 'order-service', db });
});
app.get('/api/orders/count', async (req, res) => {
  const r = await pool.query('SELECT COUNT(*)::int AS count FROM orders');
  res.json({ count: r.rows[0].count });
});

const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/metrics', async (req, res) => { res.set('Content-Type', register.contentType); res.send(await register.metrics()); });

if (require.main === module) app.listen(PORT, () => console.log(`Order service :${PORT}`));
module.exports = app;
