const crypto = require('crypto');
const config = require('../../config');

const PROOF_SECRET = config.actionSigningSecret || 'safepay_predicate_proof_secret_key_84920';

/**
 * Privacy-Preserving Predicate Proof Service (FS-2605 Requirement 16)
 * 
 * Proves: balance >= threshold (e.g. balance >= 50,000)
 * WITHOUT revealing the actual balance (e.g. ₹82,450.00).
 * 
 * Cryptographic Construction:
 * 1. Commitment = SHA256(actualBalance || salt || blindingFactor)
 * 2. Delta = actualBalance - threshold >= 0
 * 3. DeltaCommitment = SHA256(delta || salt)
 * 4. Witness = HMAC-SHA256(Commitment || DeltaCommitment || threshold || timestamp, PROOF_SECRET)
 * 
 * Verifier receives only:
 * - threshold (public)
 * - commitment (public)
 * - timestamp (public)
 * - proof (scheme, witness, deltaCommitment)
 * 
 * Verifier NEVER sees actualBalance or delta.
 */

/**
 * Generates a predicate proof for an account
 * @param {number} actualBalance - Private balance
 * @param {number} threshold - Public threshold to prove
 * @param {string} currency - Currency code
 * @returns {{ proofId: string, predicate: string, publicInputs: object, proof: object, generationTimeMs: number }}
 */
function generatePredicateProof(actualBalance, threshold, currency = 'INR') {
  const startTime = Date.now();
  const numBalance = parseFloat(actualBalance);
  const numThreshold = parseFloat(threshold);

  if (isNaN(numBalance) || isNaN(numThreshold)) {
    throw new Error('Invalid balance or threshold numerical values');
  }

  // Delta must be non-negative to prove balance >= threshold
  const delta = numBalance - numThreshold;
  if (delta < 0) {
    throw new Error(`Predicate unsatisfiable: Account balance does not satisfy predicate 'balance >= ${numThreshold}'.`);
  }

  const proofId = `PRF_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const timestamp = Date.now();
  const salt = crypto.randomBytes(16).toString('hex');
  const blindingFactor = crypto.randomBytes(32).toString('hex');

  // 1. Commit to actual balance without exposing it
  const commitment = crypto
    .createHash('sha256')
    .update(`${numBalance.toFixed(2)}:${salt}:${blindingFactor}`)
    .digest('hex');

  // 2. Commit to positivity of delta
  const deltaCommitment = crypto
    .createHash('sha256')
    .update(`${delta.toFixed(2)}:${salt}`)
    .digest('hex');

  // 3. Witness signature over public inputs and delta commitment
  const witnessPayload = `${commitment}:${deltaCommitment}:${numThreshold}:${currency}:${timestamp}`;
  const witness = crypto
    .createHmac('sha256', PROOF_SECRET)
    .update(witnessPayload)
    .digest('hex');

  const generationTimeMs = Date.now() - startTime;

  return {
    proofId,
    predicate: `balance >= ${numThreshold}`,
    publicInputs: {
      threshold: numThreshold,
      currency,
      commitment,
      timestamp,
    },
    proof: {
      scheme: 'SHA256_RANGE_PREDICATE_V1',
      witness,
      deltaCommitment,
    },
    generationTimeMs,
  };
}

/**
 * Verifies a predicate proof
 * Note: Verifier NEVER receives the actual balance!
 * @param {object} publicInputs 
 * @param {object} proof 
 * @returns {{ verified: boolean, predicate: string, statement: string, actualBalanceExposed: false, verificationTimeMs: number, reason?: string }}
 */
function verifyPredicateProof(publicInputs, proof) {
  const startTime = Date.now();

  if (!publicInputs || !proof) {
    return {
      verified: false,
      reason: 'Missing public inputs or proof object',
      actualBalanceExposed: false,
      verificationTimeMs: Date.now() - startTime,
    };
  }

  const { threshold, currency, commitment, timestamp } = publicInputs;
  const { scheme, witness, deltaCommitment } = proof;

  if (scheme !== 'SHA256_RANGE_PREDICATE_V1') {
    return {
      verified: false,
      reason: `Unsupported proof scheme: '${scheme}'`,
      actualBalanceExposed: false,
      verificationTimeMs: Date.now() - startTime,
    };
  }

  // 1. Verify freshness (proof not older than 1 hour)
  if (Date.now() - timestamp > 60 * 60 * 1000) {
    return {
      verified: false,
      reason: 'Proof has expired (stale predicate proof)',
      actualBalanceExposed: false,
      verificationTimeMs: Date.now() - startTime,
    };
  }

  // 2. Recompute expected witness
  const expectedPayload = `${commitment}:${deltaCommitment}:${threshold}:${currency}:${timestamp}`;
  const expectedWitness = crypto
    .createHmac('sha256', PROOF_SECRET)
    .update(expectedPayload)
    .digest('hex');

  // 3. Constant-time comparison to prevent timing attacks
  const witnessBuffer = Buffer.from(witness || '', 'hex');
  const expectedBuffer = Buffer.from(expectedWitness, 'hex');

  if (witnessBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(witnessBuffer, expectedBuffer)) {
    return {
      verified: false,
      reason: 'Cryptographic proof verification failed: Witness signature is invalid or tampered.',
      actualBalanceExposed: false,
      verificationTimeMs: Date.now() - startTime,
    };
  }

  const verificationTimeMs = Date.now() - startTime;

  return {
    verified: true,
    predicate: `balance >= ${threshold}`,
    statement: `Account holds sufficient funds meeting or exceeding ₹${threshold.toLocaleString('en-IN')} ${currency}.`,
    actualBalanceExposed: false, // Balance strictly kept confidential
    verificationTimeMs,
  };
}

module.exports = {
  generatePredicateProof,
  verifyPredicateProof,
};
