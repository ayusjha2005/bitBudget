const express = require('express');
const router = express.Router();
const { ATTACK_DEFINITIONS, executeAttackTest } = require('../services/security/attackSuite');
const { getDb } = require('../db/client');

/**
 * GET /attack/types
 * Returns metadata and payload templates for all 22 required attacks.
 */
router.get('/types', (req, res) => {
  res.status(200).json({
    total: ATTACK_DEFINITIONS.length,
    teamAuthoredCount: ATTACK_DEFINITIONS.filter(a => a.teamAuthored).length,
    attacks: ATTACK_DEFINITIONS.map(a => ({
      id: a.id,
      attackType: a.attackType,
      name: a.name,
      teamAuthored: a.teamAuthored,
      description: a.description,
      payload: a.payload,
      expectedDecision: a.expectedDecision,
    })),
  });
});

/**
 * POST /attack
 * Executes a specific adversarial attack against the security engine.
 * FS-2605 Requirement:
 * {
 *   "decision": "REFUSE",
 *   "detected": true,
 *   "reasons": [],
 *   "latencyMs": 123
 * }
 */
router.post('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const { attackType, payload } = req.body;

    if (!attackType) {
      return res.status(400).json({
        decision: 'REFUSE',
        detected: false,
        reasons: ['attackType field is required in request body'],
        latencyMs: 0,
      });
    }

    const result = await executeAttackTest(attackType, payload, db);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
