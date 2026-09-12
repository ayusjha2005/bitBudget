const express = require('express');
const router = express.Router();
const { generateOtp, verifyOtp } = require('../services/security/twoFactor');
const { generateActionToken } = require('../services/security/confirmation');
const { appendAuditEvent } = require('../services/audit/auditLog');
const { getDb } = require('../db/client');

/**
 * Two-Factor Authentication Routes (FS-2605 Requirement 13)
 * High-value transactions (>= ₹20,000) require an independent second factor.
 * Invoices and document text can NEVER supply or bypass this factor.
 */

/**
 * POST /2fa/resend
 * Requests a fresh OTP for an existing pending high-value action
 */
router.post('/resend', async (req, res, next) => {
  try {
    const db = await getDb();
    const { actionId } = req.body;

    if (!actionId) {
      return res.status(400).json({ success: false, error: 'actionId is required' });
    }

    const session = generateOtp(actionId);

    // Audit log 2FA challenge
    await appendAuditEvent('2FA_CHALLENGE_ISSUED', { actionId, expiresAt: session.expiresAt }, db);

    res.status(200).json({
      success: true,
      message: 'New 2FA verification code generated.',
      actionId,
      simulatedOtp: session.otp, // Displayed in simulator UI for user
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /2fa/verify
 * Validates the OTP provided directly by the user.
 * Issues the signed execution token on success.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const db = await getDb();
    const { actionId, otp, userId = 'USR_RAMESH_001', suppliedFromDocument } = req.body;

    // Security check: Document cannot supply the OTP
    if (suppliedFromDocument) {
      await appendAuditEvent('2FA_DOCUMENT_BYPASS_ATTEMPT_BLOCKED', { actionId }, db);
      return res.status(403).json({
        success: false,
        error: 'Security Policy Violation: Invoices or external documents are untrusted and cannot supply the second factor.',
      });
    }

    if (!actionId || !otp) {
      return res.status(400).json({ success: false, error: 'Both actionId and otp are required' });
    }

    const result = verifyOtp(actionId, otp);

    if (!result.verified) {
      await appendAuditEvent('2FA_VERIFICATION_FAILED', { actionId, reason: result.reason }, db);
      return res.status(403).json({
        success: false,
        error: result.reason,
      });
    }

    // Retrieve action details to issue cryptographic execution token
    const actionRes = await db.query('SELECT * FROM proposed_actions WHERE id = $1', [actionId]);
    if (actionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Associated action not found' });
    }

    const action = actionRes.rows[0];
    const accRes = await db.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
    const accountId = accRes.rows.length > 0 ? accRes.rows[0].id : 'ACC_RAMESH_SAVINGS';

    const actionToken = generateActionToken({
      actionId,
      userId,
      amount: parseFloat(action.amount),
      currency: action.currency,
      recipientId: action.recipient_id,
      accountId,
      sourceRefs: JSON.parse(action.source_refs || '[]'),
      is2FAVerified: true,
    });

    await appendAuditEvent('2FA_VERIFICATION_SUCCESS', {
      actionId,
      userId,
      amount: parseFloat(action.amount),
      recipientId: action.recipient_id,
    }, db);

    res.status(200).json({
      success: true,
      decision: 'ALLOW',
      internalState: 'CONFIRMED_2FA_SUCCESS',
      actionId,
      actionToken,
      message: 'Second factor verified. Action token issued for execution.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
