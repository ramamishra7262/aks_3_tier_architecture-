require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const morgan     = require('morgan');
const cors       = require('cors');
const { Pool }   = require('pg');
const redis      = require('redis');
const client     = require('prom-client');

const usersRouter = require('./routes/users');
const authRouter  = require('./routes/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { metricsMiddleware } = require('./middleware/metrics');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Database ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'postgres',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'appdb',
  user:     process.env.DB_USER     || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ── Redis ─────────────────────────────────────────────────────────────────────
const redisClient = redis.createClient({
  socket: { host: process.env.REDIS_HOST || 'redis', port: parseInt(process.env.REDIS_PORT || '6379') },
});
redisClient.connect().catch(err => console.error('Redis connection error:', err));

// Expose db/redis on app for route access
app.locals.pool  = pool;
app.locals.redis = redisClient;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined'));
app.use(metricsMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/users', usersRouter);
app.use('/api/auth',  authRouter);

app.get('/health', async (req, res) => {
  let dbStatus = 'ok', redisStatus = 'ok';
  try { await pool.query('SELECT 1'); } catch { dbStatus = 'error'; }
  try { await redisClient.ping(); }    catch { redisStatus = 'error'; }
  const status = dbStatus === 'ok' && redisStatus === 'ok' ? 200 : 503;
  res.status(status).json({ status: dbStatus === 'ok' ? 'ok' : 'error', service: 'user-service', db: dbStatus, redis: redisStatus });
});

app.get('/api/users/count', async (req, res) => {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  res.json({ count: result.rows[0].count });
});

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.use(errorHandler);
if (require.main === module) {
  app.listen(PORT, () => console.log(`User service running on :${PORT}`));
}
module.exports = app;
