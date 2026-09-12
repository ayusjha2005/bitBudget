const { detectInjection } = require('./injectionDetector');
const { verifyGrounding } = require('./grounding');
const { verifyRecipient } = require('./recipientVerification');
const { verifyAuthorization } = require('./authorization');
const { evaluateLimits } = require('./limits');
const { assessRisk } = require('./riskEngine');
const { generateActionToken } = require('./confirmation');
const { generateOtp } = require('./twoFactor');

/**
 * Deterministic Policy Engine (FS-2605 Core Authority)
 * 
 * "THE LLM IS UNTRUSTED. LLM proposes. Deterministic code decides."
 * Evaluates proposed actions against strict deterministic rules in fixed order.
 * 
 * Decision outputs are strictly: ALLOW, REFUSE, ESCALATE (with internal states).
 */
async function evaluatePolicy(proposedAction, context = {}, db) {
  const startTime = Date.now();
  const ruleResults = {};
  const reasons = [];
  const riskIndicators = [];

  const {
    userId = 'USR_RAMESH_001',
    rawUserInput = '',
    documentContext = {},
    userReportedScam = false,
  } = context;

  // 1. Emergency Scam Halt (Section 19: Emergency Mode)
  if (userReportedScam) {
    return {
      decision: 'REFUSE',
      internalState: 'EMERGENCY_HALTED',
      reasons: ['User flagged transaction as a potential scam. Action halted immediately.'],
      riskIndicators: ['EMERGENCY_USER_SCAM_REPORTED'],
      ruleResults: { emergencyHalt: 'TRIGGERED' },
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  // 2. Deterministic Prompt Injection & Anomaly Detection (Section 8)
  const combinedInput = `${rawUserInput} ${proposedAction.reason || ''}`.trim();
  const injectionResult = detectInjection(combinedInput, documentContext);
  ruleResults.injectionDetection = injectionResult.detected ? 'FAIL' : 'PASS';

  if (injectionResult.isMalicious) {
    reasons.push(...injectionResult.reasons);
    riskIndicators.push(...injectionResult.flags);
    return {
      decision: 'REFUSE',
      internalState: 'INJECTION_BLOCKED',
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  // 3. User & Account Authorization (Section 6)
  const authResult = await verifyAuthorization(userId, db);
  ruleResults.authorization = authResult.authorized ? 'PASS' : 'FAIL';

  if (!authResult.authorized) {
    reasons.push(authResult.reason);
    return {
      decision: 'REFUSE',
      internalState: 'UNAUTHORIZED',
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  // 4. Grounding Verification against Trusted Source (Section 7)
  const groundingResult = await verifyGrounding(proposedAction, db);
  ruleResults.grounding = groundingResult.grounded ? 'PASS' : 'FAIL';

  if (!groundingResult.grounded) {
    reasons.push(groundingResult.reason);
    riskIndicators.push(groundingResult.poisoned ? 'POISONED_DOCUMENT_DETECTED' : 'UNGROUNDED_FINANCIAL_ACTION');

    // Poisoned documents are REFUSED; general mismatches are ESCALATED for user review
    const decision = groundingResult.poisoned ? 'REFUSE' : 'ESCALATE';
    return {
      decision,
      internalState: groundingResult.poisoned ? 'POISONED_DOCUMENT_REFUSED' : 'GROUNDING_MISMATCH_ESCALATION',
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  // 5. Recipient Verification & Whitelist (Section 6)
  const recipientResult = await verifyRecipient(proposedAction.recipientId, db);
  ruleResults.recipientVerification = recipientResult.verified ? 'PASS' : 'FAIL';

  if (!recipientResult.verified) {
    reasons.push(recipientResult.reason);
    riskIndicators.push(recipientResult.isHighRisk ? 'HIGH_RISK_RECIPIENT' : 'UNVERIFIED_RECIPIENT');

    if (recipientResult.isHighRisk) {
      return {
        decision: 'REFUSE',
        internalState: 'HIGH_RISK_RECIPIENT_REFUSED',
        reasons,
        riskIndicators,
        ruleResults,
        actionToken: null,
        latencyMs: Date.now() - startTime,
      };
    }

    // Unverified or unknown recipient triggers ESCALATE
    return {
      decision: 'ESCALATE',
      internalState: 'UNVERIFIED_RECIPIENT_ESCALATED',
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  // 6. Limits and Balance Evaluation (Section 13)
  const limitsResult = await evaluateLimits(
    proposedAction.amount,
    recipientResult.recipient,
    authResult.account
  );
  ruleResults.limits = limitsResult.allowed ? 'PASS' : 'FAIL';

  if (limitsResult.insufficientFunds) {
    reasons.push(limitsResult.reason);
    return {
      decision: 'REFUSE',
      internalState: 'INSUFFICIENT_FUNDS',
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  if (limitsResult.exceedsLimit) {
    reasons.push(limitsResult.reason);
    riskIndicators.push('PAYMENT_LIMIT_EXCEEDED');
    return {
      decision: 'ESCALATE',
      internalState: 'LIMIT_EXCEEDED_ESCALATED',
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  // 7. Behavioral Risk Engine Evaluation
  const riskResult = assessRisk(proposedAction, recipientResult.recipient, {
    userReportedScam,
    isUrgentCoercion: injectionResult.flags.includes('SCAM_URGENT_FREEZE_THREAT'),
  });
  ruleResults.riskEngine = riskResult.isCriticalRisk ? 'FAIL' : 'PASS';

  if (riskResult.isCriticalRisk) {
    reasons.push('Aggregate transaction risk score exceeded safety threshold.');
    riskIndicators.push(...riskResult.flags);
    return {
      decision: 'REFUSE',
      internalState: 'HIGH_RISK_REFUSED',
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null,
      latencyMs: Date.now() - startTime,
    };
  }

  // 8. High-Value Payment -> REQUIRE_2FA
  if (limitsResult.requires2FA) {
    const actionId = `ACT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const otpSession = generateOtp(actionId);

    reasons.push(limitsResult.reason);
    return {
      decision: 'ALLOW',
      internalState: 'REQUIRE_2FA',
      requires2FA: true,
      actionId,
      simulatedOtp: otpSession.otp, // Displayed in prototype demo UI
      reasons,
      riskIndicators,
      ruleResults,
      actionToken: null, // Issued only AFTER OTP verification
      latencyMs: Date.now() - startTime,
    };
  }

  // 9. Standard Allowed Payment -> Issues Action Token for User Confirmation
  const actionId = `ACT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const actionToken = generateActionToken({
    actionId,
    userId,
    amount: proposedAction.amount,
    currency: proposedAction.currency,
    recipientId: proposedAction.recipientId,
    accountId: authResult.account.id,
    sourceRefs: proposedAction.sourceRefs,
  });

  reasons.push('Transaction satisfies all security, grounding, recipient, and limit policies.');

  return {
    decision: 'ALLOW',
    internalState: 'CONFIRMATION_PENDING',
    requires2FA: false,
    actionId,
    actionToken,
    recipient: recipientResult.recipient,
    reasons,
    riskIndicators,
    ruleResults,
    latencyMs: Date.now() - startTime,
  };
}

module.exports = {
  evaluatePolicy,
};
