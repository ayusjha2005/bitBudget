/**
 * Grounding Verification Engine (FS-2605 Requirement)
 * Ensures every financial figure (amount, currency, recipient) is strictly
 * grounded in a verified, trusted source record.
 * 
 * "If the model generates amount = 25000 but the trusted invoice says
 * amount = 2000, the action must NOT execute. Return: ESCALATE"
 */

async function verifyGrounding(proposedAction, db) {
  const { amount, currency, recipientId, sourceRefs } = proposedAction;

  if (!sourceRefs || !Array.isArray(sourceRefs) || sourceRefs.length === 0) {
    return {
      grounded: false,
      reason: 'No source reference provided. Financial requests must be grounded in a verified source.',
      mismatch: false,
    };
  }

  // Look up referenced trusted records in the database
  let matchedInvoice = null;

  for (const ref of sourceRefs) {
    try {
      const res = await db.query('SELECT * FROM invoices WHERE id::text = $1 OR invoice_number = $1 LIMIT 1', [String(ref)]);
      if (res.rows.length > 0) {
        matchedInvoice = res.rows[0];
        break;
      }
    } catch (e) {}
  }

  if (!matchedInvoice) {
    return {
      grounded: false,
      reason: `Unverified source reference: Could not find trusted invoice or billing record matching '${sourceRefs.join(', ')}'.`,
      mismatch: false,
    };
  }

  // Check 1: Document poisoned state
  if (matchedInvoice.status === 'POISONED' || (matchedInvoice.hidden_content && matchedInvoice.hidden_content.length > 0)) {
    return {
      grounded: false,
      poisoned: true,
      reason: `Referenced document '${matchedInvoice.id}' is flagged as containing conflicting or hidden adversarial content.`,
      matchedInvoice,
    };
  }

  // Check 2: Amount discrepancy
  const trustedAmount = parseFloat(matchedInvoice.amount);
  const proposedAmount = parseFloat(amount);

  if (Math.abs(trustedAmount - proposedAmount) > 0.01) {
    return {
      grounded: false,
      mismatch: true,
      reason: `Grounding Discrepancy: Proposed amount (₹${proposedAmount.toLocaleString('en-IN')}) does not match trusted invoice amount (₹${trustedAmount.toLocaleString('en-IN')}).`,
      trustedAmount,
      proposedAmount,
      matchedInvoice,
    };
  }

  // Check 3: Currency discrepancy
  if (matchedInvoice.currency !== currency) {
    return {
      grounded: false,
      mismatch: true,
      reason: `Currency Discrepancy: Proposed currency (${currency}) does not match trusted invoice currency (${matchedInvoice.currency}).`,
      matchedInvoice,
    };
  }

  // Check 4: Recipient match
  if (matchedInvoice.recipient_id && matchedInvoice.recipient_id !== recipientId) {
    return {
      grounded: false,
      mismatch: true,
      reason: `Recipient Discrepancy: Proposed recipient (${recipientId}) does not match invoice recipient (${matchedInvoice.recipient_id}).`,
      matchedInvoice,
    };
  }

  return {
    grounded: true,
    mismatch: false,
    matchedInvoice,
    reason: `All financial figures grounded in verified invoice '${matchedInvoice.invoice_number || matchedInvoice.id}'.`,
  };
}

module.exports = {
  verifyGrounding,
};
