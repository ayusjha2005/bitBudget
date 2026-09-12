const crypto = require('crypto');
const config = require('../../config');

// Prevent replay attacks by tracking consumed tokens/nonces
const consumedNonces = new Set();

/**
 * Validated Action Token Service (FS-2605 Requirement)
 * Generates and cryptographically verifies deterministic execution tokens.
 * The payment execution endpoint ONLY accepts tokens produced by this layer.
 */

/**
 * Generates an HMAC-SHA256 signed action token for an authorized action
 * @param {object} payload
 * @returns {string} actionToken
 */
function generateActionToken(payload) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const tokenData = {
    ...payload,
    nonce,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // Valid for 10 minutes
  };

  const serialized = JSON.stringify(tokenData);
  const hmac = crypto.createHmac('sha256', config.actionSigningSecret);
  hmac.update(serialized);
  const signature = hmac.digest('hex');

  const base64Data = Buffer.from(serialized).toString('base64url');
  return `${base64Data}.${signature}`;
}

/**
 * Cryptographically verifies an action token and ensures it has not been replayed
 * @param {string} token 
 * @returns {{ valid: boolean, payload?: object, reason?: string }}
 */
function verifyActionToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Action token is missing or malformed' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid token structure' };
  }

  const [base64Data, providedSignature] = parts;

  let serialized;
  let payload;
  try {
    serialized = Buffer.from(base64Data, 'base64url').toString('utf-8');
    payload = JSON.parse(serialized);
  } catch (err) {
    return { valid: false, reason: 'Failed to decode token payload' };
  }

  // 1. Verify HMAC signature
  const hmac = crypto.createHmac('sha256', config.actionSigningSecret);
  hmac.update(serialized);
  const expectedSignature = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: 'Cryptographic signature verification failed. Token was tampered with.' };
  }

  // 2. Check expiration
  if (Date.now() > payload.expiresAt) {
    return { valid: false, reason: 'Action token has expired' };
  }

  // 3. Replay attack defense
  if (consumedNonces.has(payload.nonce)) {
    return { valid: false, reason: 'Replay attack detected: This action token has already been executed.' };
  }

  return {
    valid: true,
    payload,
  };
}

/**
 * Marks a token's nonce as consumed once executed
 * @param {string} nonce 
 */
function consumeTokenNonce(nonce) {
  consumedNonces.add(nonce);
}

module.exports = {
  generateActionToken,
  verifyActionToken,
  consumeTokenNonce,
};
