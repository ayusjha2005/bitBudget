const request = require('supertest');
const app = require('../app');

describe('Phase 1: Project Setup & Health Endpoint', () => {
  it('GET /healthz should return 200 OK with system status', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'safepay-ai');
    expect(response.body).toHaveProperty('deterministicSecurityEngine', 'active');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptimeSeconds');
  });

  it('Centralized error handler should fail-closed with REFUSE decision', async () => {
    const response = await request(app).get('/test-error');
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('decision', 'REFUSE');
    expect(response.body.error).toHaveProperty('code', 'INTERNAL_ERROR');
  });
});
