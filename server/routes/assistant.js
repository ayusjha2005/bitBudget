const express = require('express');
const router = express.Router();
const { modelRouter } = require('../services/ai/modelRouter');
const { parseTypedActionFromLlm } = require('../schemas/typedAction');
const { evaluatePolicy } = require('../services/security/policyEngine');
const { getDb } = require('../db/client');

/**
 * POST /assistant/message
 * Handles natural language text and voice queries in English, Hindi, and Hinglish.
 * Adheres to: "LLM proposes. Deterministic code decides."
 */
router.post('/message', async (req, res, next) => {
  try {
    const db = await getDb();
    const {
      message,
      userId = 'USR_RAMESH_001',
      userReportedScam = false,
      documentContext = {},
    } = req.body;

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
    const actionId = evaluation.actionId || `ACT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const decisionId = `DEC_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.query(`
      INSERT INTO proposed_actions (
        id, user_id, action_type, amount, currency, recipient_id, source_refs, reason, raw_llm_output, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET status = $10
    `, [
      actionId,
      userId,
      candidateAction.actionType,
      candidateAction.amount,
      candidateAction.currency,
      candidateAction.recipientId,
      JSON.stringify(candidateAction.sourceRefs || []),
      candidateAction.reason,
      aiResult.rawOutput,
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

module.exports = router;
