const request = require('supertest');
const app = require('../app');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 10: High-Value Payments & Two-Factor Authentication (2FA)', () => {
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

  it('TEST 1: High-value proposal generates 2FA session and pending OTP', async () => {
    // Insert high-value invoice
    await db.query(`
      INSERT INTO invoices (id, user_id, recipient_id, amount, currency, status, visible_content, hidden_content)
      VALUES ('INV_HIGH_2FA_25000', 'USR_RAMESH_001', 'REC_ELECTRICITY_BOARD', 25000.00, 'INR', 'VERIFIED', 'High value commercial power', '')
      ON CONFLICT (id) DO NOTHING;
    `);

    const res = await request(app)
      .post('/payment/propose')
      .send({
        action: {
          actionType: 'PAYMENT',
          amount: 25000.00,
          currency: 'INR',
          recipientId: 'REC_ELECTRICITY_BOARD',
          sourceRefs: ['INV_HIGH_2FA_25000'],
          reason: 'Commercial bill payment',
        },
        userId: 'USR_RAMESH_001',
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.internalState).toBe('REQUIRE_2FA');
    expect(res.body.requires2FA).toBe(true);
    expect(res.body.simulatedOtp).toBeDefined();
    expect(res.body.actionId).toBeDefined();
  });

  it('TEST 2: POST /2fa/resend issues a fresh OTP for the pending action', async () => {
    const actionId = 'ACT_2FA_RESEND_TEST';
    await db.query(`
      INSERT INTO proposed_actions (id, user_id, action_type, amount, currency, recipient_id, status)
      VALUES ($1, 'USR_RAMESH_001', 'PAYMENT', 22000, 'INR', 'REC_ELECTRICITY_BOARD', 'PENDING')
      ON CONFLICT (id) DO NOTHING;
    `, [actionId]);

    const res = await request(app)
      .post('/2fa/resend')
      .send({ actionId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.simulatedOtp).toBeDefined();
    expect(res.body.simulatedOtp.length).toBe(6);
  });

  it('TEST 3: Wrong OTP decrements attempts and rejects with 403', async () => {
    const actionId = 'ACT_2FA_WRONG_TEST';
    await db.query(`
      INSERT INTO proposed_actions (id, user_id, action_type, amount, currency, recipient_id, status)
      VALUES ($1, 'USR_RAMESH_001', 'PAYMENT', 22000, 'INR', 'REC_ELECTRICITY_BOARD', 'PENDING')
      ON CONFLICT (id) DO NOTHING;
    `, [actionId]);

    // Request fresh OTP
    await request(app).post('/2fa/resend').send({ actionId });

    // Send incorrect OTP
    const res = await request(app)
      .post('/2fa/verify')
      .send({ actionId, otp: '000000', userId: 'USR_RAMESH_001' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid OTP');
  });

  it('TEST 4: External document cannot supply second factor (Anti-Bypass Protection)', async () => {
    const res = await request(app)
      .post('/2fa/verify')
      .send({
        actionId: 'ACT_HIGH_VAL',
        otp: '123456',
        suppliedFromDocument: true, // Document injection attempt
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Invoices or external documents are untrusted');
  });

  it('TEST 5: Valid OTP verification produces signed execution token and logs audit event', async () => {
    const actionId = 'ACT_2FA_VALID_TEST';
    await db.query(`
      INSERT INTO proposed_actions (id, user_id, action_type, amount, currency, recipient_id, status)
      VALUES ($1, 'USR_RAMESH_001', 'PAYMENT', 24000, 'INR', 'REC_ELECTRICITY_BOARD', 'PENDING')
      ON CONFLICT (id) DO NOTHING;
    `, [actionId]);

    // Request OTP
    const resendRes = await request(app).post('/2fa/resend').send({ actionId });
    const correctOtp = resendRes.body.simulatedOtp;

    // Verify OTP
    const verifyRes = await request(app)
      .post('/2fa/verify')
      .send({ actionId, otp: correctOtp, userId: 'USR_RAMESH_001' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.actionToken).toBeDefined();

    // Verify audit log has 2FA_VERIFICATION_SUCCESS
    const auditRes = await request(app).get('/audit');
    const has2FAAudit = auditRes.body.events.some(e => e.eventType === '2FA_VERIFICATION_SUCCESS');
    expect(has2FAAudit).toBe(true);
  });
});
