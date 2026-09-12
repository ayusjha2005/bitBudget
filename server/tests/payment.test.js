const request = require('supertest');
const app = require('../app');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 5: Payment Simulator & Execution Flow', () => {
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

  it('Full Flow: Propose legitimate payment -> ALLOW -> Execute with token -> Balance deducted', async () => {
    // 1. Propose payment
    const proposeRes = await request(app)
      .post('/payment/propose')
      .send({
        action: {
          actionType: 'PAYMENT',
          amount: 2000.00,
          currency: 'INR',
          recipientId: 'REC_ELECTRICITY_BOARD',
          sourceRefs: ['INV_ELECTRICITY_2000'],
          reason: 'Electricity bill payment for August 2026',
        },
        rawUserInput: 'Pay my electricity bill ₹2,000',
        userId: 'USR_RAMESH_001',
      });

    expect(proposeRes.status).toBe(200);
    expect(proposeRes.body.decision).toBe('ALLOW');
    expect(proposeRes.body.actionToken).toBeDefined();

    const actionToken = proposeRes.body.actionToken;

    // 2. Validate token
    const validateRes = await request(app)
      .post('/payment/validate')
      .send({ actionToken });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.valid).toBe(true);

    // 3. Execute payment using validated token
    const execRes = await request(app)
      .post('/payment/execute')
      .send({ actionToken });

    expect(execRes.status).toBe(200);
    expect(execRes.body.success).toBe(true);
    expect(execRes.body.transactionId).toBeDefined();
    expect(execRes.body.previousBalance).toBe(82450.00);
    expect(execRes.body.newBalance).toBe(80450.00);

    // Verify balance in database
    const accCheck = await db.query('SELECT * FROM accounts WHERE id = $1', ['ACC_RAMESH_SAVINGS']);
    expect(parseFloat(accCheck.rows[0].balance)).toBe(80450.00);

    // 4. Replay attack attempt: Try executing same token again
    const replayRes = await request(app)
      .post('/payment/execute')
      .send({ actionToken });

    expect(replayRes.status).toBe(403);
    expect(replayRes.body.success).toBe(false);
    expect(replayRes.body.error).toContain('Replay attack');
  });

  it('Security: Direct payment execution without actionToken must be rejected (400)', async () => {
    const res = await request(app)
      .post('/payment/execute')
      .send({
        amount: 2000,
        recipientId: 'REC_ELECTRICITY_BOARD',
        command: 'EXECUTE_PAYMENT_DIRECTLY',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('No actionToken provided');
  });

  it('Security: Tampered or forged action token must be rejected (403)', async () => {
    const forgedToken = 'eyJhbGciOiJIUzI1NiJ9.forged_payload.invalid_signature_38921';
    const res = await request(app)
      .post('/payment/execute')
      .send({ actionToken: forgedToken });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Security Authorization Refused');
  });

  it('High-Value Flow: Propose high-value -> REQUIRE_2FA -> Confirm with OTP -> Execute', async () => {
    // Insert high-value invoice
    await db.query(`
      INSERT INTO invoices (id, user_id, recipient_id, amount, currency, status, visible_content, hidden_content)
      VALUES ('INV_HIGH_VAL_22000', 'USR_RAMESH_001', 'REC_ELECTRICITY_BOARD', 22000.00, 'INR', 'VERIFIED', 'High value commercial power', '')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 1. Propose payment of ₹22,000
    const proposeRes = await request(app)
      .post('/payment/propose')
      .send({
        action: {
          actionType: 'PAYMENT',
          amount: 22000.00,
          currency: 'INR',
          recipientId: 'REC_ELECTRICITY_BOARD',
          sourceRefs: ['INV_HIGH_VAL_22000'],
          reason: 'Commercial power bill',
        },
        rawUserInput: 'Pay commercial electricity bill ₹22,000',
        userId: 'USR_RAMESH_001',
      });

    expect(proposeRes.status).toBe(200);
    expect(proposeRes.body.decision).toBe('ALLOW');
    expect(proposeRes.body.internalState).toBe('REQUIRE_2FA');
    expect(proposeRes.body.actionToken).toBeNull(); // No token until 2FA verified
    expect(proposeRes.body.simulatedOtp).toBeDefined();

    const actionId = proposeRes.body.actionId;
    const otp = proposeRes.body.simulatedOtp;

    // 2. Confirm 2FA with OTP
    const confirmRes = await request(app)
      .post('/payment/confirm')
      .send({ actionId, otp, userId: 'USR_RAMESH_001' });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.actionToken).toBeDefined();

    // 3. Execute with 2FA-issued token
    const execRes = await request(app)
      .post('/payment/execute')
      .send({ actionToken: confirmRes.body.actionToken });

    expect(execRes.status).toBe(200);
    expect(execRes.body.success).toBe(true);
    expect(execRes.body.amount).toBe(22000);
  });
});
