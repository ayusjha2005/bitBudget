const config = require('../../config');

/**
 * Payment Limits and Threshold Evaluator (FS-2605 Requirement)
 * Configurable thresholds:
 * - normal payment: ₹5,000
 * - new recipient: ₹3,000
 * - high value: ₹20,000+ (requires 2FA)
 */
function evaluateLimits(amount, recipient, account) {
  const numAmount = parseFloat(amount);
  const userBalance = account ? parseFloat(account.balance) : 0;
  const limits = config.limits;

  // 1. Account balance check
  if (numAmount > userBalance) {
    return {
      allowed: false,
      insufficientFunds: true,
      requires2FA: false,
      exceedsLimit: false,
      reason: `Insufficient account balance. Requested: ₹${numAmount.toLocaleString('en-IN')}, Available: ₹${userBalance.toLocaleString('en-IN')}.`,
    };
  }

  // 2. High-value threshold check (>= ₹20,000)
  if (numAmount >= limits.highValueThreshold) {
    return {
      allowed: true,
      insufficientFunds: false,
      requires2FA: true,
      exceedsLimit: false,
      thresholdType: 'HIGH_VALUE',
      reason: `High-value payment (₹${numAmount.toLocaleString('en-IN')} >= ₹${limits.highValueThreshold.toLocaleString('en-IN')}) requires explicit second-factor authentication (2FA).`,
    };
  }

  // 3. New or unverified recipient limit check (₹3,000)
  if (!recipient || !recipient.is_verified) {
    if (numAmount > limits.newRecipientMax) {
      return {
        allowed: false,
        insufficientFunds: false,
        requires2FA: false,
        exceedsLimit: true,
        thresholdType: 'NEW_RECIPIENT_LIMIT_EXCEEDED',
        reason: `Payment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds limit for new or unverified recipients (₹${limits.newRecipientMax.toLocaleString('en-IN')}).`,
      };
    }
  }

  // 4. Normal payment limit check (₹5,000)
  if (numAmount > limits.normalMax) {
    return {
      allowed: false,
      insufficientFunds: false,
      requires2FA: false,
      exceedsLimit: true,
      thresholdType: 'STANDARD_LIMIT_EXCEEDED',
      reason: `Payment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds the standard single-transaction limit of ₹${limits.normalMax.toLocaleString('en-IN')}. Escalation required.`,
    };
  }

  return {
    allowed: true,
    insufficientFunds: false,
    requires2FA: false,
    exceedsLimit: false,
    thresholdType: 'NORMAL',
    reason: `Payment amount ₹${numAmount.toLocaleString('en-IN')} is within normal limit (₹${limits.normalMax.toLocaleString('en-IN')}).`,
  };
}

module.exports = {
  evaluateLimits,
};
