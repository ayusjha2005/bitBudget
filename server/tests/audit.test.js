const request = require('supertest');
const app = require('../app');
const { appendAuditEvent, verifyAuditChain } = require('../services/audit/auditLog');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 9: Tamper-Evident Audit Log (SHA-256 Hash Chain)', () => {
  let db;

  beforeEach(async () => {
    // Reseed fresh database before each test for predictable chain state
    await initializeSchemaAndSeed(true);
    db = await getDb();
  });

  afterAll(async () => {
    if (db && db.close) {
      await db.close();
    }
  });

  it('TEST 1: GET /audit should return chronological audit events including genesis', async () => {
    const res = await request(app).get('/audit');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);

    const genesis = res.body.events[0];
    expect(genesis.eventId).toBe('AUDIT_GENESIS_000');
    expect(genesis.previousHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(genesis.currentHash).toBeDefined();
  });

  it('TEST 2: GET /audit/verify should verify hash chain integrity on pristine logs', async () => {
    // Append 3 sample events
    await appendAuditEvent('USER_LOGIN', { userId: 'USR_RAMESH_001', ip: '127.0.0.1' }, db);
    await appendAuditEvent('INVOICE_SCANNED', { invoiceId: 'INV_ELECTRICITY_2000', amount: 2000 }, db);
    await appendAuditEvent('POLICY_EVALUATED', { decision: 'ALLOW', amount: 2000 }, db);

    const res = await request(app).get('/audit/verify');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.chainLength).toBe(4); // Genesis + 3 events
    expect(res.body.message).toContain('verified successfully');
  });

  it('TEST 3: Payment execution automatically creates audit event and preserves chain validity', async () => {
    // Propose payment
    const proposeRes = await request(app)
      .post('/payment/propose')
      .send({
        action: {
          actionType: 'PAYMENT',
          amount: 2000.00,
          currency: 'INR',
          recipientId: 'REC_ELECTRICITY_BOARD',
          sourceRefs: ['INV_ELECTRICITY_2000'],
          reason: 'Electricity payment test',
        },
        userId: 'USR_RAMESH_001',
      });

    // Execute payment
    await request(app)
      .post('/payment/execute')
      .send({ actionToken: proposeRes.body.actionToken });

    // Verify audit log includes PAYMENT_EXECUTED
    const auditRes = await request(app).get('/audit');
    const paymentEvent = auditRes.body.events.find(e => e.eventType === 'PAYMENT_EXECUTED');
    expect(paymentEvent).toBeDefined();
    expect(paymentEvent.eventData.amount).toBe(2000);

    // Verify full chain remains valid
    const verifyRes = await request(app).get('/audit/verify');
    expect(verifyRes.body.valid).toBe(true);
  });

  it('TEST 4: Tampering with audit event data MUST cause /audit/verify to fail and identify the modified record', async () => {
    // Append valid events
    const evt = await appendAuditEvent('PAYMENT_EXECUTED', { amount: 2000, recipient: 'REC_ELECTRICITY_BOARD' }, db);

    // Verify chain is initially valid
    const initialVerify = await verifyAuditChain(db);
    expect(initialVerify.valid).toBe(true);

    // Intentionally tamper with event_data in database
    await request(app)
      .post('/audit/tamper-test')
      .send({
        eventId: evt.event_id,
        forgedData: { amount: 999999, recipient: 'ATTACKER_POCKET' },
      });

    // Verification must now fail!
    const tamperedVerify = await request(app).get('/audit/verify');
    expect(tamperedVerify.status).toBe(200);
    expect(tamperedVerify.body.valid).toBe(false);
    expect(tamperedVerify.body.errorType).toBe('MODIFIED_EVENT_DATA');
    expect(tamperedVerify.body.eventId).toBe(evt.event_id);
    expect(tamperedVerify.body.details).toContain('has been modified');
  });
});
