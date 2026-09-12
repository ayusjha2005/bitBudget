/**
 * Risk Analysis Engine (FS-2605 Requirement)
 * Aggregates behavioral risk signals, velocity, and scam indicators.
 */

function assessRisk(proposedAction, recipient, userContext = {}) {
  const flags = [];
  let score = 0.0; // 0.0 to 1.0

  const amount = parseFloat(proposedAction.amount || 0);

  // 1. Recipient risk propagation
  if (recipient) {
    const recRisk = parseFloat(recipient.risk_score || 0);
    score += recRisk * 0.5;
    if (!recipient.is_verified) {
      flags.push('RISK_UNVERIFIED_RECIPIENT');
      score += 0.25;
    }
  } else {
    flags.push('RISK_UNKNOWN_RECIPIENT');
    score += 0.5;
  }

  // 2. High amount risk weight
  if (amount >= 20000) {
    flags.push('RISK_HIGH_VALUE_TRANSACTION');
    score += 0.2;
  }

  // 3. Urgent or coercive context
  if (userContext.isUrgentCoercion) {
    flags.push('RISK_SOCIAL_ENGINEERING_PRESSURE');
    score += 0.6;
  }

  // 4. Emergency scam reported by user
  if (userContext.userReportedScam) {
    flags.push('EMERGENCY_USER_SCAM_REPORTED');
    score = 1.0;
  }

  score = Math.min(1.0, Math.max(0.0, score));

  return {
    score: parseFloat(score.toFixed(2)),
    flags,
    isElevatedRisk: score >= 0.5,
    isCriticalRisk: score >= 0.8,
  };
}

module.exports = {
  assessRisk,
};
