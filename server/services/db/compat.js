const crypto = require('crypto');

function isUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function ensureUUID(id) {
  if (isUUID(id)) return id;
  return crypto.randomUUID();
}

/**
 * Saves proposed action to database matching the active schema (Supabase UUID or local standard)
 */
async function saveProposedAction(db, data) {
  const {
    id,
    userId,
    actionType,
    amount,
    currency = 'INR',
    recipientId,
    sourceRefs = [],
    reason = '',
    rawOutput = null,
    status = 'PENDING',
  } = data;

  try {
    // Check if Supabase schema (has column 'ai_reason')
    const colCheck = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'proposed_actions' AND column_name = 'ai_reason' LIMIT 1"
    );

    if (colCheck.rows && colCheck.rows.length > 0) {
      // Supabase UUID schema
      const validId = ensureUUID(id);
      const validUserId = isUUID(userId) ? userId : null;
      const validRecipientId = isUUID(recipientId) ? recipientId : null;

      if (!validUserId) {
        // If user doesn't exist yet, fetch first available user
        const u = await db.query('SELECT id FROM users LIMIT 1');
        if (u.rows.length > 0) {
          validUserId = u.rows[0].id;
        }
      }

      if (validUserId) {
        await db.query(`
          INSERT INTO proposed_actions (
            id, user_id, action_type, amount, currency, recipient_id, source_refs, 
            ai_reason, raw_ai_output, normalized_action, policy_version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET ai_reason = $8
        `, [
          validId,
          validUserId,
          actionType || 'PAYMENT',
          amount || 0,
          currency,
          validRecipientId,
          JSON.stringify(sourceRefs || []),
          reason,
          typeof rawOutput === 'object' ? JSON.stringify(rawOutput) : JSON.stringify({ text: rawOutput || '' }),
          JSON.stringify({ actionType, amount, currency, recipientId, sourceRefs }),
          '1.0.0',
        ]);
      }
      return validId;
    } else {
      // Standard local schema
      const actionId = id || `ACT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await db.query(`
        INSERT INTO proposed_actions (
          id, user_id, action_type, amount, currency, recipient_id, source_refs, reason, raw_llm_output, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET status = $10
      `, [
        actionId,
        userId,
        actionType || 'PAYMENT',
        amount || 0,
        currency,
        recipientId,
        JSON.stringify(sourceRefs || []),
        reason,
        rawOutput,
        status,
      ]);
      return actionId;
    }
  } catch (err) {
    console.warn('[SafePay DB] Warning saving proposed_action:', err.message);
    return id || ensureUUID(id);
  }
}

/**
 * Saves security decision to database matching the active schema
 */
async function saveSecurityDecision(db, data) {
  const {
    id,
    actionId,
    decision,
    internalState,
    reasons = [],
    riskIndicators = [],
    ruleResults = {},
    actionToken = null,
    riskScore = 0,
  } = data;

  try {
    const colCheck = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'security_decisions' AND column_name = 'action_id' LIMIT 1"
    );

    if (colCheck.rows && colCheck.rows.length > 0) {
      // Supabase UUID schema
      const validId = ensureUUID(id);
      const validActionId = ensureUUID(actionId);
      const normalizedScore = Math.min(1.0, Math.max(0.0, parseFloat(riskScore > 1 ? riskScore / 100 : riskScore) || 0));

      await db.query(`
        INSERT INTO security_decisions (
          id, action_id, decision, risk_score, risk_reasons, policy_version, deterministic
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        validId,
        validActionId,
        decision,
        normalizedScore,
        JSON.stringify(reasons || []),
        '1.0.0',
        true,
      ]);
      return validId;
    } else {
      // Standard local schema
      const decisionId = id || `DEC_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await db.query(`
        INSERT INTO security_decisions (
          id, proposed_action_id, decision, internal_state, reasons, risk_indicators, rule_results, action_token
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        decisionId,
        actionId,
        decision,
        internalState,
        JSON.stringify(reasons || []),
        JSON.stringify(riskIndicators || []),
        JSON.stringify(ruleResults || {}),
        actionToken,
      ]);
      return decisionId;
    }
  } catch (err) {
    console.warn('[SafePay DB] Warning saving security_decision:', err.message);
    return id || ensureUUID(id);
  }
}

module.exports = {
  isUUID,
  ensureUUID,
  saveProposedAction,
  saveSecurityDecision,
};
