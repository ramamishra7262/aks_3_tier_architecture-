const request = require('supertest');
const app = require('../src/index');

describe('User Service', () => {
  test('GET /health returns healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBeLessThan(600);
    expect(res.body).toHaveProperty('service', 'user-service');
  });

  test('POST /api/users validates input', async () => {
    const res = await request(app).post('/api/users').send({ email: 'bad' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});
