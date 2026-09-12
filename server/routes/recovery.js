const express = require('express');
const router = express.Router();
const { initiateRecovery, verifyRecoveryFactor, DEMO_MASTER_RECOVERY_KEY } = require('../services/recovery/recoveryService');
const { getDb } = require('../db/client');

/**
 * POST /recovery/request
 * Initiates a 2-of-3 device loss recovery protocol.
 */
router.post('/request', async (req, res, next) => {
  try {
    const db = await getDb();
    const { userId = 'USR_RAMESH_001' } = req.body;

    const result = await initiateRecovery(userId, db);
    res.status(200).json({
      ...result,
      demoRecoveryKeyHint: 'For hackathon demo, Factor C Master Recovery Key is: ' + DEMO_MASTER_RECOVERY_KEY,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /recovery/verify
 * Submits a factor (FACTOR_A, FACTOR_B, or FACTOR_C) to satisfy the 2-of-3 threshold.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const db = await getDb();
    const { recoveryId, factorType, factorValue } = req.body;

    if (!recoveryId || !factorType) {
      return res.status(400).json({
        success: false,
        error: 'recoveryId and factorType are required.',
      });
    }

    const result = await verifyRecoveryFactor(recoveryId, factorType, factorValue, db);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
