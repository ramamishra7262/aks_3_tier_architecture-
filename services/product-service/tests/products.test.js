const request = require('supertest');
const app = require('../src/index');
describe('Product Service', () => {
  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('service', 'product-service');
  });
  test('POST validation', async () => {
    const res = await request(app).post('/api/products').send({ price: 'bad' });
    expect(res.statusCode).toBe(400);
  });
});
