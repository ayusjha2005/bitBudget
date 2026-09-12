const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 2: Database Schema & Seed Data', () => {
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

  it('should seed user Ramesh Kumar with Hindi preference', async () => {
    const res = await db.query('SELECT * FROM users WHERE id = $1', ['USR_RAMESH_001']);
    expect(res.rows.length).toBe(1);
    const user = res.rows[0];
    expect(user.name).toBe('Ramesh Kumar');
    expect(user.preferred_language).toBe('hi');
    expect(user.status).toBe('ACTIVE');
  });

  it('should seed account with exact balance ₹82,450.00', async () => {
    const res = await db.query('SELECT * FROM accounts WHERE user_id = $1', ['USR_RAMESH_001']);
    expect(res.rows.length).toBe(1);
    const account = res.rows[0];
    expect(parseFloat(account.balance)).toBe(82450.00);
    expect(account.currency).toBe('INR');
  });

  it('should have verified recipients and an unverified high-risk recipient', async () => {
    const res = await db.query('SELECT * FROM recipients ORDER BY id ASC');
    expect(res.rows.length).toBeGreaterThanOrEqual(3);

    const electricity = res.rows.find(r => r.id === 'REC_ELECTRICITY_BOARD');
    expect(electricity).toBeDefined();
    expect(electricity.is_verified).toBe(true);

    const scammer = res.rows.find(r => r.id === 'REC_UNKNOWN_SCAMMER');
    expect(scammer).toBeDefined();
    expect(scammer.is_verified).toBe(false);
    expect(parseFloat(scammer.risk_score)).toBeGreaterThan(0.9);
  });

  it('should seed legitimate invoice of ₹2,000 and poisoned invoice of ₹5,000 with hidden instructions', async () => {
    const res = await db.query('SELECT * FROM invoices ORDER BY id ASC');
    expect(res.rows.length).toBeGreaterThanOrEqual(2);

    const legitimate = res.rows.find(i => i.id === 'INV_ELECTRICITY_2000');
    expect(legitimate).toBeDefined();
    expect(parseFloat(legitimate.amount)).toBe(2000.00);
    expect(legitimate.status).toBe('VERIFIED');

    const poisoned = res.rows.find(i => i.id === 'INV_POISONED_5000');
    expect(poisoned).toBeDefined();
    expect(parseFloat(poisoned.amount)).toBe(5000.00);
    expect(poisoned.hidden_content).toContain('2,00,000');
  });

  it('should have genesis audit log entry with root previous_hash', async () => {
    const res = await db.query('SELECT * FROM audit_logs WHERE event_id = $1', ['AUDIT_GENESIS_000']);
    expect(res.rows.length).toBe(1);
    const genesis = res.rows[0];
    expect(genesis.previous_hash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(genesis.current_hash).toBeDefined();
  });
});
