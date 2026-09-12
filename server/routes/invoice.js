const express = require('express');
const router = express.Router();
const { parseDocument, analyzeAndEvaluateInvoice } = require('../services/document/docService');
const { getDb } = require('../db/client');

/**
 * POST /invoice/analyze
 * Analyzes uploaded invoice / PDF document, extracts visible & hidden layers,
 * and passes the candidate action through the deterministic security engine.
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const db = await getDb();
    const { invoiceId, content } = req.body;

    let docAnalysis;
    let targetInvoiceId = invoiceId;

    // Support friendly demo aliases
    if (invoiceId === 'legitimate_bill') {
      targetInvoiceId = 'INV_ELECTRICITY_2000';
    } else if (invoiceId === 'poisoned_bill') {
      targetInvoiceId = 'INV_POISONED_5000';
    }

    if (targetInvoiceId) {
      // Look up pre-seeded or previously stored invoice
      const invRes = await db.query('SELECT * FROM invoices WHERE id = $1', [targetInvoiceId]);
      if (invRes.rows.length === 0) {
        return res.status(404).json({
          decision: 'REFUSE',
          error: `Invoice '${invoiceId}' not found.`,
        });
      }

      const inv = invRes.rows[0];
      docAnalysis = {
        visibleText: inv.visible_content || '',
        hiddenContent: inv.hidden_content || '',
        rawHash: inv.raw_document_hash || '',
      };
    } else if (content) {
      // Analyze submitted document string / content
      docAnalysis = await parseDocument(content);
      targetInvoiceId = `INV_UP_${Date.now()}`;
    } else {
      return res.status(400).json({
        decision: 'REFUSE',
        error: 'Either invoiceId or content is required.',
      });
    }

    // Process through document service and security engine
    const result = await analyzeAndEvaluateInvoice(docAnalysis, targetInvoiceId, db);

    const isAllow = result.evaluation.decision === 'ALLOW';
    const explanationText = isAllow
      ? `Verified ${targetInvoiceId}: ₹${result.visibleAmount} for State Electricity Board. Cryptographic Action Token issued.`
      : (result.evaluation.reasons?.[0] || 'Document refused due to prompt injection or ungrounded instruction.');

    res.status(200).json({
      success: true,
      invoiceId: result.invoiceId,
      visibleText: result.visibleText,
      hiddenContent: result.hiddenContent,
      isPoisoned: result.isPoisoned,
      proposedAction: result.proposedAction,
      action: {
        intent: 'PAYMENT',
        amount: result.visibleAmount,
        currency: 'INR',
        recipient: {
          name: 'State Electricity Board',
          accountNumber: 'EEB9920192841029',
          isWhitelisted: true,
        },
        sourceRefs: [result.invoiceId],
      },
      decision: result.evaluation.decision,
      policyDecision: result.evaluation,
      internalState: result.evaluation.internalState,
      reasons: result.evaluation.reasons,
      riskIndicators: result.evaluation.riskIndicators,
      riskScore: result.isPoisoned ? 95 : 15,
      actionId: result.evaluation.actionId,
      actionToken: result.evaluation.actionToken,
      requires2FA: result.evaluation.requires2FA || false,
      reply: explanationText,
      explanation: explanationText,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
