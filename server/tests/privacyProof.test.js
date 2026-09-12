const request = require('supertest');
const app = require('../app');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 11: Privacy-Preserving Predicate Proof (FS-2605 Requirement 16)', () => {
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

  it('TEST 1: Generate predicate proof (balance >= 50,000) without revealing actual balance', async () => {
    const res = await request(app)
      .post('/proof/generate')
      .send({
        userId: 'USR_RAMESH_001',
        threshold: 50000,
        currency: 'INR',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.predicate).toBe('balance >= 50000');
    expect(res.body.actualBalanceExposed).toBe(false);
    expect(res.body.publicInputs).toBeDefined();
    expect(res.body.publicInputs.threshold).toBe(50000);
    expect(res.body.proof).toBeDefined();

    // Verify actual balance (82450) is NEVER exposed in the JSON response
    const jsonString = JSON.stringify(res.body);
    expect(jsonString.includes('82450')).toBe(false);

    // Performance target: generation < 3,000 ms
    expect(res.body.generationTimeMs).toBeLessThan(3000);
  });

  it('TEST 2: Verify predicate proof successfully without knowing actual balance', async () => {
    // 1. Generate proof
    const genRes = await request(app)
      .post('/proof/generate')
      .send({
        userId: 'USR_RAMESH_001',
        threshold: 50000,
        currency: 'INR',
      });

    const { publicInputs, proof } = genRes.body;

    // 2. Verify proof with ONLY public inputs and proof
    const verifyRes = await request(app)
      .post('/proof/verify')
      .send({ publicInputs, proof });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.verified).toBe(true);
    expect(verifyRes.body.predicate).toBe('balance >= 50000');
    expect(verifyRes.body.actualBalanceExposed).toBe(false);
    expect(verifyRes.body.statement).toContain('50,000');

    // Performance target: verification < 200 ms
    expect(verifyRes.body.verificationTimeMs).toBeLessThan(200);

    // Verify response does not leak balance
    expect(JSON.stringify(verifyRes.body).includes('82450')).toBe(false);
  });

  it('TEST 3: Reject unsatisfiable predicate (e.g. balance >= 500,000 when balance is 82,450)', async () => {
    const res = await request(app)
      .post('/proof/generate')
      .send({
        userId: 'USR_RAMESH_001',
        threshold: 500000, // Impossible! Actual balance is 82,450
        currency: 'INR',
      });

    expect(res.status).toBe(500); // Fail-closed error handler
    expect(res.body.decision).toBe('REFUSE');
  });

  it('TEST 4: Tampered proof or commitment MUST be rejected by verifier', async () => {
    const genRes = await request(app)
      .post('/proof/generate')
      .send({
        userId: 'USR_RAMESH_001',
        threshold: 50000,
      });

    const { publicInputs, proof } = genRes.body;

    // Tamper with public threshold (claim we proved 75,000 with proof for 50,000)
    const tamperedInputs = {
      ...publicInputs,
      threshold: 75000,
    };

    const verifyRes = await request(app)
      .post('/proof/verify')
      .send({ publicInputs: tamperedInputs, proof });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.verified).toBe(false);
    expect(verifyRes.body.reason).toContain('failed');
  });
});
