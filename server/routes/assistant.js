const express = require('express');
const router = express.Router();
const { modelRouter } = require('../services/ai/modelRouter');
const { parseTypedActionFromLlm } = require('../schemas/typedAction');
const { evaluatePolicy } = require('../services/security/policyEngine');
const { getDb } = require('../db/client');
const { saveProposedAction, saveSecurityDecision } = require('../services/db/compat');

/**
 * POST /assistant/message
 * Handles natural language text and voice queries in English, Hindi, and Hinglish.
 * Adheres to: "LLM proposes. Deterministic code decides."
 */
router.post('/message', async (req, res, next) => {
  try {
    const db = await getDb();
    let {
      message,
      userId = 'USR_RAMESH_001',
      userReportedScam = false,
      documentContext = {},
    } = req.body;

    // Resolve active userId from database if available
    try {
      const uRes = await db.query('SELECT id FROM users LIMIT 1');
      if (uRes.rows.length > 0 && (!req.body.userId || req.body.userId === 'USR_RAMESH_001')) {
        userId = uRes.rows[0].id;
      }
    } catch (e) {}

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        decision: 'REFUSE',
        error: 'Message text is required',
      });
    }

    // 0. Deterministic rule-based checks around the model (FS-2605 Section 8)
    const { detectInjection } = require('../services/security/injectionDetector');
    const preCheck = detectInjection(message, documentContext);
    if (preCheck.isMalicious) {
      return res.status(200).json({
        success: true,
        message,
        reply: 'Adversarial instruction or scam threat detected. This request has been blocked by the deterministic security engine.',
        explanation: 'Adversarial instruction or scam threat detected. This request has been blocked.',
        decision: 'REFUSE',
        internalState: 'INJECTION_BLOCKED',
        reasons: preCheck.reasons,
        riskIndicators: preCheck.flags,
        riskScore: 95,
        action: null,
        actionToken: null,
      });
    }

    // 1. Perceptual AI layer proposes action or conversational answer
    const aiResult = await modelRouter.routeMessage(message, { userId });

    // 2. Check if AI proposed a financial action
    if (!aiResult.rawOutput) {
      return res.status(200).json({
        message,
        explanation: aiResult.explanation,
        decision: 'INFO',
        proposedAction: null,
        modelProviderUsed: aiResult.providerUsed,
        fallbackTriggered: aiResult.fallbackTriggered,
      });
    }

    // 3. Parse and strictly validate proposal structure
    const parsedAction = parseTypedActionFromLlm(aiResult.rawOutput);
    if (!parsedAction.valid) {
      return res.status(200).json({
        message,
        explanation: 'The assistant could not formulate a valid, secure payment request.',
        decision: 'REFUSE',
        internalState: 'MALFORMED_PROPOSAL_REJECTED',
        reasons: parsedAction.errors,
        riskIndicators: ['INVALID_TYPED_ACTION_FORMAT'],
        actionToken: null,
        modelProviderUsed: aiResult.providerUsed,
        fallbackTriggered: aiResult.fallbackTriggered,
      });
    }

    const candidateAction = parsedAction.data;

    // 4. Deterministic security engine evaluates the proposal
    const evaluation = await evaluatePolicy(candidateAction, {
      userId,
      rawUserInput: message,
      documentContext,
      userReportedScam,
    }, db);

    // 5. Record proposed action & decision in database
    const actionId = await saveProposedAction(db, {
      id: evaluation.actionId,
      userId,
      actionType: candidateAction.actionType,
      amount: candidateAction.amount,
      currency: candidateAction.currency,
      recipientId: candidateAction.recipientId,
      sourceRefs: candidateAction.sourceRefs,
      reason: candidateAction.reason,
      rawOutput: aiResult.rawOutput,
      status: evaluation.decision,
    });

    const decisionId = await saveSecurityDecision(db, {
      actionId,
      decision: evaluation.decision,
      internalState: evaluation.internalState,
      reasons: evaluation.reasons,
      riskIndicators: evaluation.riskIndicators,
      ruleResults: evaluation.ruleResults,
      actionToken: evaluation.actionToken || null,
      riskScore: evaluation.decision === 'REFUSE' ? 90 : evaluation.requires2FA ? 45 : 15,
    });

    res.status(200).json({
      success: true,
      message,
      reply: aiResult.explanation,
      explanation: aiResult.explanation,
      decision: evaluation.decision,
      internalState: evaluation.internalState,
      action: {
        intent: candidateAction.actionType || 'PAYMENT',
        amount: candidateAction.amount,
        currency: candidateAction.currency || 'INR',
        recipient: evaluation.recipient || {
          name: candidateAction.recipientId || 'Recipient',
          accountNumber: candidateAction.recipientId,
          isWhitelisted: Boolean(evaluation.recipient?.is_verified || evaluation.ruleResults?.recipientVerification === 'PASS'),
        },
        sourceRefs: candidateAction.sourceRefs,
      },
      proposedAction: candidateAction,
      actionId,
      actionToken: evaluation.actionToken || null,
      simulatedOtp: evaluation.simulatedOtp || null,
      requires2FA: evaluation.requires2FA || false,
      recipient: evaluation.recipient || null,
      reasons: evaluation.reasons,
      riskIndicators: evaluation.riskIndicators,
      riskScore: evaluation.decision === 'REFUSE' ? 90 : evaluation.requires2FA ? 45 : 15,
      modelRoute: aiResult.providerUsed || 'offline-deterministic',
      modelProviderUsed: aiResult.providerUsed,
      fallbackTriggered: aiResult.fallbackTriggered,
      latencyMs: evaluation.latencyMs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /assistant/user
 * Returns profile and balance of the primary account from the connected database
 */
router.get('/user', async (req, res, next) => {
  try {
    const db = await getDb();
    const userRes = await db.query(`
      SELECT u.id, u.name, 
             COALESCE(u.phone, '') as phone,
             COALESCE(u.language, 'en') as preferred_language,
             COALESCE(a.balance, 0.00) as balance,
             COALESCE(a.currency, 'INR') as currency
      FROM users u 
      LEFT JOIN accounts a ON a.user_id = u.id 
      LIMIT 1
    `);

    if (userRes.rows.length === 0) {
      return res.status(200).json({
        success: true,
        user: null,
        balance: 0.00,
        currency: 'INR',
        message: 'No users found in connected database. Ready for user creation.',
      });
    }

    const row = userRes.rows[0];
    res.status(200).json({
      success: true,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        preferredLanguage: row.preferred_language,
      },
      balance: parseFloat(row.balance || 0),
      currency: row.currency || 'INR',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
