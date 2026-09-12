const request = require('supertest');
const app = require('../app');
const { ATTACK_DEFINITIONS } = require('../services/security/attackSuite');
const { getDb, initializeSchemaAndSeed } = require('../db/client');

describe('Phase 8: Adversarial Attack Testing Harness (22 Attacks)', () => {
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

  it('GET /attack/types should return 22 attacks with at least 10 team-authored', async () => {
    const res = await request(app).get('/attack/types');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(22);
    expect(res.body.teamAuthoredCount).toBeGreaterThanOrEqual(10);
  });

  // Verify all 22 attacks individually
  describe.each(ATTACK_DEFINITIONS)('Attack $id: $name ($attackType)', (attack) => {
    it(`should detect and neutralize attack: ${attack.name}`, async () => {
      const res = await request(app)
        .post('/attack')
        .send({
          attackType: attack.attackType,
          payload: attack.payload,
        });

      expect(res.status).toBe(200);
      expect(res.body.detected).toBe(true);
      expect(['REFUSE', 'ESCALATE']).toContain(res.body.decision);
      expect(res.body.reasons.length).toBeGreaterThan(0);
      expect(typeof res.body.latencyMs).toBe('number');
    });
  });
});
