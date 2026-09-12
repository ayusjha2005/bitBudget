const express = require('express');
const router = express.Router();
const { validateTypedAction } = require('../schemas/typedAction');
const { evaluatePolicy } = require('../services/security/policyEngine');
const { verifyActionToken, generateActionToken } = require('../services/security/confirmation');
const { verifyOtp } = require('../services/security/twoFactor');
const { executePayment } = require('../services/payment/simulator');
const { getDb } = require('../db/client');

/**
 * POST /payment/propose
 * Accepts raw natural language or candidate action proposal.
 * Passes proposal strictly through the deterministic security engine.
 */
router.post('/propose', async (req, res, next) => {
  try {
    const db = await getDb();
    const { action, rawUserInput, documentContext, userId = 'USR_RAMESH_001', userReportedScam } = req.body;

    // Validate structure of candidate action if provided
    let candidateAction = action;
    if (action) {
      const validation = validateTypedAction(action);
      if (!validation.valid) {
        return res.status(400).json({
          decision: 'REFUSE',
          errors: validation.errors,
          reasons: ['Malformed or unauthorized action structure'],
        });
      }
      candidateAction = validation.data;
    } else {
      return res.status(400).json({
        decision: 'REFUSE',
        reasons: ['No action object provided to propose endpoint'],
      });
    }

    // Evaluate through deterministic policy engine
    const evaluation = await evaluatePolicy(candidateAction, {
      userId,
      rawUserInput,
      documentContext,
      userReportedScam,
    }, db);

    // Record decision in database
    const decisionId = `DEC_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const actionId = evaluation.actionId || `ACT_${Date.now()}`;

    // Ensure proposed action is tracked in DB
    await db.query(`
      INSERT INTO proposed_actions (
        id, user_id, action_type, amount, currency, recipient_id, source_refs, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [
      actionId,
      userId,
      candidateAction.actionType,
      candidateAction.amount,
      candidateAction.currency,
      candidateAction.recipientId,
      JSON.stringify(candidateAction.sourceRefs || []),
      candidateAction.reason,
      evaluation.decision,
    ]);

    await db.query(`
      INSERT INTO security_decisions (
        id, proposed_action_id, decision, internal_state, reasons, risk_indicators, rule_results, action_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      decisionId,
      actionId,
      evaluation.decision,
      evaluation.internalState,
      JSON.stringify(evaluation.reasons || []),
      JSON.stringify(evaluation.riskIndicators || []),
      JSON.stringify(evaluation.ruleResults || {}),
      evaluation.actionToken || null,
    ]);

    res.status(200).json(evaluation);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payment/validate
 * Validates cryptographic action token without executing.
 */
router.post('/validate', async (req, res, next) => {
  try {
    const { actionToken } = req.body;
    if (!actionToken) {
      return res.status(400).json({ valid: false, reason: 'actionToken is required' });
    }

    const result = verifyActionToken(actionToken);
    res.status(result.valid ? 200 : 403).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payment/confirm
 * For high-value payments requiring 2FA OTP verification.
 * Verifies OTP and generates the execution action token upon success.
 */
router.post('/confirm', async (req, res, next) => {
  try {
    const db = await getDb();
    const { actionId, otp, userId = 'USR_RAMESH_001' } = req.body;

    if (!actionId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Both actionId and otp are required for 2FA confirmation.',
      });
    }

    const otpVerification = verifyOtp(actionId, otp);
    if (!otpVerification.verified) {
      return res.status(403).json({
        success: false,
        error: otpVerification.reason,
      });
    }

    // Retrieve proposed action details to generate token
    const actionRes = await db.query('SELECT * FROM proposed_actions WHERE id = $1', [actionId]);
    if (actionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proposed action not found' });
    }

    const action = actionRes.rows[0];
    const accRes = await db.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
    const accountId = accRes.rows.length > 0 ? accRes.rows[0].id : 'ACC_RAMESH_SAVINGS';

    // Issue cryptographic action token
    const actionToken = generateActionToken({
      actionId,
      userId,
      amount: parseFloat(action.amount),
      currency: action.currency,
      recipientId: action.recipient_id,
      accountId,
      sourceRefs: JSON.parse(action.source_refs || '[]'),
    });

    res.status(200).json({
      success: true,
      decision: 'ALLOW',
      internalState: 'CONFIRMED_2FA_SUCCESS',
      actionId,
      actionToken,
      message: '2FA verified successfully. Action token issued for execution.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payment/execute
 * Executes payment strictly through validated action token.
 * Does NOT accept arbitrary JSON or LLM text.
 */
router.post('/execute', async (req, res, next) => {
  try {
    const db = await getDb();
    const { actionToken } = req.body;

    if (!actionToken) {
      return res.status(400).json({
        success: false,
        error: 'Execution denied: No actionToken provided. Payment execution requires a validated cryptographic token.',
      });
    }

    const result = await executePayment(actionToken, db);
    if (!result.success) {
      return res.status(result.statusCode || 403).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
