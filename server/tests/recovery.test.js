const request = require('supertest');
const app = require('../app');
const { DEMO_MASTER_RECOVERY_KEY } = require('../services/recovery/recoveryService');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 12: Device-Loss Recovery (2-of-3 Protocol)', () => {
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

  it('TEST 1: POST /recovery/request should initiate a 2-of-3 recovery session', async () => {
    const res = await request(app)
      .post('/recovery/request')
      .send({ userId: 'USR_RAMESH_001' });

    expect(res.status).toBe(200);
    expect(res.body.recoveryId).toBeDefined();
    expect(res.body.status).toBe('PENDING');
    expect(res.body.requiredFactors).toBe(2);
    expect(res.body.totalFactors).toBe(3);
    expect(res.body.simulatedFactorAOtp).toBeDefined();
    expect(res.body.simulatedFactorBToken).toBeDefined();
    expect(res.body.trustedContact.name).toBe('Suresh Kumar');
  });

  it('TEST 2: Submitting only 1 factor (Factor A) must NOT recover the account (Single factor insufficient)', async () => {
    // 1. Initiate session
    const initRes = await request(app)
      .post('/recovery/request')
      .send({ userId: 'USR_RAMESH_001' });

    const { recoveryId, simulatedFactorAOtp } = initRes.body;

    // 2. Verify Factor A only
    const factorRes = await request(app)
      .post('/recovery/verify')
      .send({
        recoveryId,
        factorType: 'FACTOR_A',
        factorValue: simulatedFactorAOtp,
      });

    expect(factorRes.status).toBe(200);
    expect(factorRes.body.success).toBe(true);
    expect(factorRes.body.completed).toBe(false); // MUST NOT be completed
    expect(factorRes.body.factorsSatisfied).toBe(1);
    expect(factorRes.body.message).toContain('Single factor is insufficient');
  });

  it('TEST 3: Submitting 2 independent factors (Factor A + Factor B) satisfies threshold and restores access', async () => {
    // 1. Initiate session
    const initRes = await request(app)
      .post('/recovery/request')
      .send({ userId: 'USR_RAMESH_001' });

    const { recoveryId, simulatedFactorAOtp, simulatedFactorBToken } = initRes.body;

    // 2. Verify Factor A (User OTP)
    await request(app)
      .post('/recovery/verify')
      .send({
        recoveryId,
        factorType: 'FACTOR_A',
        factorValue: simulatedFactorAOtp,
      });

    // 3. Verify Factor B (Trusted Contact Approval)
    const factorBRes = await request(app)
      .post('/recovery/verify')
      .send({
        recoveryId,
        factorType: 'FACTOR_B',
        factorValue: simulatedFactorBToken,
      });

    expect(factorBRes.status).toBe(200);
    expect(factorBRes.body.success).toBe(true);
    expect(factorBRes.body.completed).toBe(true); // Complete!
    expect(factorBRes.body.factorsSatisfied).toBe(2);
    expect(factorBRes.body.recoveryToken).toBeDefined();

    // Verify audit log has RECOVERY_COMPLETED
    const auditRes = await request(app).get('/audit');
    expect(auditRes.body.events.some(e => e.eventType === 'RECOVERY_COMPLETED')).toBe(true);
  });

  it('TEST 4: Submitting Factor A + Factor C (Master Recovery Key) also satisfies 2-of-3 threshold', async () => {
    // 1. Initiate session
    const initRes = await request(app)
      .post('/recovery/request')
      .send({ userId: 'USR_RAMESH_001' });

    const { recoveryId, simulatedFactorAOtp } = initRes.body;

    // 2. Factor A
    await request(app)
      .post('/recovery/verify')
      .send({ recoveryId, factorType: 'FACTOR_A', factorValue: simulatedFactorAOtp });

    // 3. Factor C (Master Key)
    const factorCRes = await request(app)
      .post('/recovery/verify')
      .send({
        recoveryId,
        factorType: 'FACTOR_C',
        factorValue: DEMO_MASTER_RECOVERY_KEY,
      });

    expect(factorCRes.status).toBe(200);
    expect(factorCRes.body.completed).toBe(true);
    expect(factorCRes.body.factorsSatisfied).toBe(2);
  });

  it('TEST 5: Invalid factor values must be rejected', async () => {
    const initRes = await request(app).post('/recovery/request').send({ userId: 'USR_RAMESH_001' });
    const { recoveryId } = initRes.body;

    const res = await request(app)
      .post('/recovery/verify')
      .send({
        recoveryId,
        factorType: 'FACTOR_A',
        factorValue: '000000', // Invalid OTP
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid');
  });
});
