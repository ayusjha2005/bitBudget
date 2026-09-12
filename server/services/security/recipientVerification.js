/**
 * Recipient Verification Engine (FS-2605 Requirement)
 * Verifies recipient identities against the trusted system directory.
 */

async function verifyRecipient(recipientId, db) {
  if (!recipientId) {
    return {
      verified: false,
      exists: false,
      isHighRisk: false,
      reason: 'No recipientId specified in payment proposal.',
    };
  }

  const res = await db.query('SELECT * FROM recipients WHERE id = $1', [recipientId]);
  if (res.rows.length === 0) {
    return {
      verified: false,
      exists: false,
      isHighRisk: false,
      reason: `Recipient '${recipientId}' is not registered in the verified recipient directory.`,
    };
  }

  const recipient = res.rows[0];
  const riskScore = parseFloat(recipient.risk_score || 0);

  if (riskScore >= 0.8) {
    return {
      verified: false,
      exists: true,
      isHighRisk: true,
      recipient,
      reason: `Recipient '${recipient.name}' is flagged as high-risk (Risk Score: ${riskScore.toFixed(2)}).`,
    };
  }

  if (!recipient.is_verified) {
    return {
      verified: false,
      exists: true,
      isHighRisk: false,
      recipient,
      reason: `Recipient '${recipient.name}' is registered but has not completed formal verification.`,
    };
  }

  return {
    verified: true,
    exists: true,
    isHighRisk: false,
    recipient,
    reason: `Recipient '${recipient.name}' is verified and in good standing.`,
  };
}

module.exports = {
  verifyRecipient,
};
