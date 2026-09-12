const express = require('express');
const router = express.Router();
const { getElderExplanation, analyzeIsThisSafe, handleEmergencyScamHalt } = require('../services/security/elderAssistant');
const { getDb } = require('../db/client');

/**
 * POST /elder/explain
 * Translates a security decision into an elder-friendly visual and voice script.
 */
router.post('/explain', (req, res) => {
  const { decision = 'REFUSE', language = 'hi' } = req.body;
  const explanation = getElderExplanation(decision, language);
  res.status(200).json({
    decision,
    language,
    explanation,
  });
});

/**
 * POST /elder/is-this-safe
 * "Is this safe?" feature: Analyzes a message (SMS / WhatsApp) for elders.
 */
router.post('/is-this-safe', (req, res) => {
  const { message, language = 'hi' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const result = analyzeIsThisSafe(message, language);
  res.status(200).json(result);
});

/**
 * POST /elder/emergency-halt
 * Emergency Scam Mode: "I think this is a scam"
 * Cancels pending actions, preserves evidence, alerts trusted family contact.
 */
router.post('/emergency-halt', async (req, res, next) => {
  try {
    const db = await getDb();
    const { userId = 'USR_RAMESH_001', pendingActionId, evidence } = req.body;

    const result = await handleEmergencyScamHalt(userId, pendingActionId, evidence, db);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
