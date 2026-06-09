const request = require('supertest');
const app = require('../src/index');
describe('Order Service', () => {
  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('service', 'order-service');
  });
  test('POST validation rejects empty body', async () => {
    const res = await request(app).post('/api/orders').send({});
    expect(res.statusCode).toBe(400);
  });
});
