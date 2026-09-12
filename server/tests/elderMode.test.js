const request = require('supertest');
const app = require('../app');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 13: Elder Mode & Accessibility Layer (FS-2605 Requirements 18 & 19)', () => {
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

  it('TEST 1: Elder explanation in Hindi for REFUSE decision returns clear compassionate guidance', async () => {
    const res = await request(app)
      .post('/elder/explain')
      .send({
        decision: 'REFUSE',
        language: 'hi',
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation.verdict).toContain('खतरा');
    expect(res.body.explanation.voiceScript).toContain('कृपया पैसे न भेजें');
    expect(res.body.explanation.simpleSummary).toContain('SafePay');
  });

  it('TEST 2: Elder explanation in Tamil for REFUSE decision', async () => {
    const res = await request(app)
      .post('/elder/explain')
      .send({
        decision: 'REFUSE',
        language: 'ta',
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation.verdict).toContain('ஆபத்து');
    expect(res.body.explanation.voiceScript).toContain('பணம் செலுத்த வேண்டாம்');
  });

  it('TEST 3: Elder explanation in Hinglish matches Section 18 example', async () => {
    const res = await request(app)
      .post('/elder/explain')
      .send({
        decision: 'REFUSE',
        language: 'hinglish',
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation.voiceScript).toContain('Nahi. Is message mein account band hone ki dhamki');
  });

  it('TEST 4: "Is this safe?" mode identifies threatening message as dangerous', async () => {
    const res = await request(app)
      .post('/elder/is-this-safe')
      .send({
        message: 'Mujhe ye message samajh nahi aa raha. Urgent payment ₹25,000 needed or bank account will be frozen today.',
        language: 'hi',
      });

    expect(res.status).toBe(200);
    expect(res.body.isSafe).toBe(false);
    expect(res.body.decision).toBe('REFUSE');
    expect(res.body.familyContactNotice).toContain('Suresh Kumar');
  });

  it('TEST 5: "Is this safe?" mode identifies legitimate electricity payment as safe', async () => {
    const res = await request(app)
      .post('/elder/is-this-safe')
      .send({
        message: 'Pay my regular electricity bill ₹2000',
        language: 'en',
      });

    expect(res.status).toBe(200);
    expect(res.body.isSafe).toBe(true);
    expect(res.body.decision).toBe('ALLOW');
  });

  it('TEST 6: Emergency Scam Mode ("I think this is a scam") immediately halts pending action and logs audit event', async () => {
    // 1. Create a pending action
    const actionId = 'ACT_EMERGENCY_TEST_99';
    await db.query(`
      INSERT INTO proposed_actions (id, user_id, action_type, amount, currency, recipient_id, status)
      VALUES ($1, 'USR_RAMESH_001', 'PAYMENT', 5000, 'INR', 'REC_ELECTRICITY_BOARD', 'PENDING')
      ON CONFLICT (id) DO NOTHING;
    `, [actionId]);

    // 2. Trigger Emergency Halt
    const haltRes = await request(app)
      .post('/elder/emergency-halt')
      .send({
        userId: 'USR_RAMESH_001',
        pendingActionId: actionId,
        evidence: { userPrompt: 'I think this is a scam! Please cancel.' },
      });

    expect(haltRes.status).toBe(200);
    expect(haltRes.body.success).toBe(true);
    expect(haltRes.body.action).toBe('EMERGENCY_STOPPED');
    expect(haltRes.body.familyNotified.name).toBe('Suresh Kumar');

    // 3. Verify action status in DB
    const checkRes = await db.query('SELECT status FROM proposed_actions WHERE id = $1', [actionId]);
    expect(checkRes.rows[0].status).toBe('CANCELLED_EMERGENCY_SCAM');

    // 4. Verify audit event
    const auditRes = await request(app).get('/audit');
    expect(auditRes.body.events.some(e => e.eventType === 'EMERGENCY_SCAM_HALTED')).toBe(true);
  });
});
