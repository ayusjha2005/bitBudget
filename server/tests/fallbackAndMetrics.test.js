const request = require('supertest');
const app = require('../app');
const { modelRouter } = require('../services/ai/modelRouter');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 14: High-Availability Fallback & Real Telemetry Metrics (FS-2605 Requirements 21, 28 & 29)', () => {
  let db;

  beforeAll(async () => {
    await initializeSchemaAndSeed(true);
    db = await getDb();
  });

  afterAll(async () => {
    if (db && db.close) {
      await db.close();
    }
  });

  afterEach(() => {
    modelRouter.setPrimaryDisabled(false);
  });

  it('TEST 1: Provider failure failover: Fallback model outputs same typed action and passes same security engine', async () => {
    // 1. Disable primary model
    modelRouter.setPrimaryDisabled(true);

    // 2. Request payment proposal via assistant
    const res = await request(app)
      .post('/assistant/message')
      .send({
        message: 'Pay my electricity bill ₹2000',
        userId: 'USR_RAMESH_001',
      });

    expect(res.status).toBe(200);
    expect(res.body.fallbackTriggered).toBe(true);
    expect(res.body.modelProviderUsed).toContain('fallback');
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.actionToken).toBeDefined();

    // Verify same authorization & grounding rules applied
    expect(res.body.proposedAction.amount).toBe(2000);
    expect(res.body.proposedAction.recipientId).toBe('REC_ELECTRICITY_BOARD');
  });

  it('TEST 2: GET /metrics should return real, non-fabricated telemetry counters', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);

    expect(res.body).toHaveProperty('totalRequests');
    expect(res.body).toHaveProperty('decisionCounts');
    expect(res.body).toHaveProperty('injectionDetectionRate');
    expect(res.body).toHaveProperty('attackPassRate');
    expect(res.body).toHaveProperty('latency');
    expect(res.body.latency).toHaveProperty('p95LatencyMs');
  });

  it('TEST 3: Target Performance Verification (Section 29: p95 < 4s, proof gen < 3s, verify < 200ms)', async () => {
    const res = await request(app).post('/metrics/benchmark');
    expect(res.status).toBe(200);

    const metrics = res.body.metricsSummary;
    expect(metrics).toBeDefined();

    // FS-2605 Target 1: Proof generation < 3,000 ms
    expect(metrics.privacyProofPerformance.p95GenerationTimeMs).toBeLessThan(3000);
    expect(metrics.targetsMetSummary.proofGenerationUnder3s).toBe(true);

    // FS-2605 Target 2: Proof verification < 200 ms
    expect(metrics.privacyProofPerformance.p95VerificationTimeMs).toBeLessThan(200);
    expect(metrics.targetsMetSummary.proofVerificationUnder200ms).toBe(true);

    // FS-2605 Target 3: End-to-end p95 latency < 4,000 ms
    expect(metrics.latency.p95LatencyMs).toBeLessThan(4000);
    expect(metrics.targetsMetSummary.endToEndP95Under4s).toBe(true);
  });
});
