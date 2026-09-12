const crypto = require('crypto');
const { appendAuditEvent } = require('../audit/auditLog');

// Master recovery key for demo user Ramesh Kumar
const DEMO_MASTER_RECOVERY_KEY = 'REC-KEY-RAMESH-8492-7491-0192';

// In-memory active recovery session storage
const activeRecoverySessions = new Map();

/**
 * 2-of-3 Device Loss Recovery Protocol (FS-2605 Requirement 17)
 * 
 * Factors:
 * Factor A: OTP (sent to user registered device/email)
 * Factor B: Trusted Contact approval (Suresh Kumar)
 * Factor C: Master Recovery Key (offline physical backup)
 * 
 * Security Principle:
 * A single factor MUST NEVER be sufficient to recover the account.
 * Requires at least 2 independent factors.
 */

/**
 * Initiates a new 2-of-3 recovery session
 * @param {string} userId 
 * @param {object} db 
 */
async function initiateRecovery(userId = 'USR_RAMESH_001', db) {
  const recoveryId = `REC_SESS_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const factorAOtp = ((crypto.randomBytes(3).readUIntBE(0, 3) % 900000) + 100000).toString();
  const factorBToken = `TC_APPROVE_${crypto.randomBytes(8).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const session = {
    recoveryId,
    userId,
    factorAOtp,
    factorBToken,
    factorAVerified: false,
    factorBVerified: false,
    factorCVerified: false,
    expiresAt,
    trustedContact: {
      name: 'Suresh Kumar',
      relation: 'Brother / Trusted Contact',
      phone: '+91-9876500001',
    },
  };

  activeRecoverySessions.set(recoveryId, session);

  // Store in database
  await db.query(`
    INSERT INTO recovery_requests (
      id, user_id, factor_a_otp_verified, factor_b_contact_verified, factor_c_key_verified,
      trusted_contact_id, status, expires_at
    ) VALUES ($1, $2, FALSE, FALSE, FALSE, 'TC_SURESH_KUMAR', 'PENDING', $3)
  `, [recoveryId, userId, expiresAt.toISOString()]);

  // Audit event
  await appendAuditEvent('RECOVERY_REQUESTED', { recoveryId, userId, expiresAt }, db);

  return {
    recoveryId,
    userId,
    status: 'PENDING',
    requiredFactors: 2,
    totalFactors: 3,
    simulatedFactorAOtp: factorAOtp,
    simulatedFactorBToken: factorBToken,
    trustedContact: session.trustedContact,
    expiresAt,
  };
}

/**
 * Submits a factor for verification in the 2-of-3 protocol
 * @param {string} recoveryId 
 * @param {string} factorType - 'FACTOR_A' | 'FACTOR_B' | 'FACTOR_C'
 * @param {string} factorValue 
 * @param {object} db 
 */
async function verifyRecoveryFactor(recoveryId, factorType, factorValue, db) {
  const session = activeRecoverySessions.get(recoveryId);

  if (!session) {
    return {
      success: false,
      error: 'Active recovery session not found or expired.',
      completed: false,
    };
  }

  if (Date.now() > session.expiresAt.getTime()) {
    activeRecoverySessions.delete(recoveryId);
    return {
      success: false,
      error: 'Recovery session has expired. Please initiate a new recovery request.',
      completed: false,
    };
  }

  const cleanValue = String(factorValue || '').trim();

  // Validate submitted factor
  switch (factorType) {
    case 'FACTOR_A': {
      if (session.factorAOtp !== cleanValue) {
        return { success: false, error: 'Invalid Factor A OTP code.', completed: false };
      }
      session.factorAVerified = true;
      break;
    }
    case 'FACTOR_B': {
      if (session.factorBToken !== cleanValue) {
        return { success: false, error: 'Invalid Factor B trusted contact approval token.', completed: false };
      }
      session.factorBVerified = true;
      break;
    }
    case 'FACTOR_C': {
      if (cleanValue !== DEMO_MASTER_RECOVERY_KEY) {
        return { success: false, error: 'Invalid Factor C master emergency recovery key.', completed: false };
      }
      session.factorCVerified = true;
      break;
    }
    default:
      return { success: false, error: `Unknown factorType: ${factorType}`, completed: false };
  }

  // Count verified factors
  const verifiedCount = (session.factorAVerified ? 1 : 0) +
                        (session.factorBVerified ? 1 : 0) +
                        (session.factorCVerified ? 1 : 0);

  // Update database status
  await db.query(`
    UPDATE recovery_requests
    SET factor_a_otp_verified = $1, factor_b_contact_verified = $2, factor_c_key_verified = $3
    WHERE id = $4
  `, [session.factorAVerified, session.factorBVerified, session.factorCVerified, recoveryId]);

  await appendAuditEvent('RECOVERY_FACTOR_VERIFIED', {
    recoveryId,
    factorType,
    verifiedCount,
  }, db);

  // Check 2-of-3 threshold
  if (verifiedCount >= 2) {
    await db.query("UPDATE recovery_requests SET status = 'COMPLETED' WHERE id = $1", [recoveryId]);
    await appendAuditEvent('RECOVERY_COMPLETED', {
      recoveryId,
      userId: session.userId,
      verifiedCount,
    }, db);

    activeRecoverySessions.delete(recoveryId);

    const recoveryToken = `RCV_TOKEN_${crypto.randomBytes(16).toString('hex')}`;

    return {
      success: true,
      completed: true,
      recoveryId,
      factorsSatisfied: verifiedCount,
      recoveryToken,
      message: '2-of-3 Recovery threshold satisfied! Device access restored successfully.',
    };
  }

  return {
    success: true,
    completed: false,
    recoveryId,
    factorType,
    factorsSatisfied: verifiedCount,
    requiredFactors: 2,
    message: `${verifiedCount} of 2 required factors verified. Single factor is insufficient for security. Second independent factor required.`,
  };
}

module.exports = {
  DEMO_MASTER_RECOVERY_KEY,
  initiateRecovery,
  verifyRecoveryFactor,
};
