const client = require('prom-client');
const httpRequests = new client.Counter({
  name: 'user_service_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});
const metricsMiddleware = (req, res, next) => {
  res.on('finish', () => {
    httpRequests.inc({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
};
module.exports = { metricsMiddleware };
