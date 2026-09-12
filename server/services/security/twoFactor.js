const crypto = require('crypto');

// Simulated OTP storage (keyed by actionId)
const otpStore = new Map();

/**
 * Two-Factor Authentication Service (FS-2605 Requirement)
 * High-value transactions (>= ₹20,000) require an independent second factor.
 * The invoice or document NEVER has authority to supply or bypass this factor.
 */

/**
 * Generates an OTP for a high-value pending action
 * @param {string} actionId 
 * @returns {{ otp: string, expiresAt: number }}
 */
function generateOtp(actionId) {
  // 6-digit cryptographically secure numeric OTP
  const buffer = crypto.randomBytes(3);
  const otpNumber = (buffer.readUIntBE(0, 3) % 900000) + 100000;
  const otp = otpNumber.toString();

  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  otpStore.set(actionId, {
    otp,
    expiresAt,
    attempts: 0,
  });

  return {
    otp, // Returned for dev/simulator display to user
    expiresAt,
  };
}

/**
 * Verifies the second factor provided explicitly by the user
 * @param {string} actionId 
 * @param {string} providedOtp 
 * @returns {{ verified: boolean, reason: string }}
 */
function verifyOtp(actionId, providedOtp) {
  if (!otpStore.has(actionId)) {
    return {
      verified: false,
      reason: 'No active 2FA session found for this action, or session has expired.',
    };
  }

  const session = otpStore.get(actionId);

  if (Date.now() > session.expiresAt) {
    otpStore.delete(actionId);
    return {
      verified: false,
      reason: '2FA OTP has expired. Please request a new verification code.',
    };
  }

  session.attempts += 1;
  if (session.attempts > 3) {
    otpStore.delete(actionId);
    return {
      verified: false,
      reason: 'Maximum 2FA verification attempts exceeded. Action cancelled for security.',
    };
  }

  if (session.otp !== String(providedOtp).trim()) {
    return {
      verified: false,
      reason: `Invalid OTP code. Remaining attempts: ${3 - session.attempts}.`,
    };
  }

  // OTP is verified; remove from store to prevent replay
  otpStore.delete(actionId);
  return {
    verified: true,
    reason: 'Two-factor authentication verified successfully.',
  };
}

module.exports = {
  generateOtp,
  verifyOtp,
};
