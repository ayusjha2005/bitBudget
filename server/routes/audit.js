const express = require('express');
const router = express.Router();
const { verifyAuditChain, appendAuditEvent } = require('../services/audit/auditLog');
const { getDb } = require('../db/client');

/**
 * GET /audit
 * Returns list of chronological audit events with their hash links.
 */
router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const limit = parseInt(req.query.limit || '50', 10);
    const logsRes = await db.query(
      'SELECT id, event_id, event_type, event_data, previous_hash, current_hash, timestamp FROM audit_logs ORDER BY id ASC LIMIT $1',
      [limit]
    );

    res.status(200).json({
      count: logsRes.rows.length,
      events: logsRes.rows.map(r => ({
        id: r.id,
        eventId: r.event_id,
        eventType: r.event_type,
        eventData: JSON.parse(r.event_data || '{}'),
        previousHash: r.previous_hash,
        currentHash: r.current_hash,
        timestamp: r.timestamp,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /audit/verify
 * Cryptographically verifies the entire hash chain for tampering or broken links.
 */
router.get('/verify', async (req, res, next) => {
  try {
    const db = await getDb();
    const verification = await verifyAuditChain(db);
    res.status(200).json(verification);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /audit/tamper-test
 * (Demonstration / Test endpoint)
 * Intentionally alters the event data of an existing audit entry to test that
 * /audit/verify detects the modification.
 */
router.post('/tamper-test', async (req, res, next) => {
  try {
    const db = await getDb();
    const { eventId, forgedData } = req.body;

    const targetRes = await db.query(
      eventId
        ? 'SELECT * FROM audit_logs WHERE event_id = $1'
        : 'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1',
      eventId ? [eventId] : []
    );

    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'No audit event found to tamper with' });
    }

    const target = targetRes.rows[0];
    const tamperedContent = JSON.stringify(forgedData || {
      forged: true,
      amount: 999999,
      note: 'ATTACKER_MODIFIED_RECORD',
    });

    await db.query('UPDATE audit_logs SET event_data = $1 WHERE id = $2', [tamperedContent, target.id]);

    res.status(200).json({
      message: `Audit record ${target.event_id} has been intentionally modified for testing.`,
      tamperedEventId: target.event_id,
      originalHash: target.current_hash,
      notice: 'Call GET /audit/verify now to observe verification detection.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
