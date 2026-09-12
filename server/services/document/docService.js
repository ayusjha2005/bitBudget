const { execFile } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { normalizeText } = require('../security/normalizer');
const { evaluatePolicy } = require('../security/policyEngine');

/**
 * Document Analysis Service (FS-2605 Requirement)
 * Extracts visible and hidden layers from PDF or text invoices,
 * separates trusted visual billing figures from untrusted hidden instructions.
 */

/**
 * Analyzes document text or file path
 * @param {string} input - File path or raw document string
 * @returns {Promise<{ visibleText: string, hiddenContent: string, rawHash: string }>}
 */
async function parseDocument(input) {
  // Try calling Python extractor
  const scriptPath = path.join(__dirname, 'extractor.py');

  return new Promise((resolve) => {
    // Attempt execution with python / py
    const pythonExe = process.platform === 'win32' ? 'py' : 'python3';
    execFile(pythonExe, [scriptPath, input], { timeout: 4000 }, (error, stdout) => {
      if (!error && stdout) {
        try {
          const parsed = JSON.parse(stdout.trim());
          return resolve(parsed);
        } catch (e) {
          // Fall back to in-process JS extraction
        }
      }

      // Fallback in-process extraction
      const rawHash = crypto.createHash('sha256').update(input).digest('hex');
      let visibleText = input;
      let hiddenContent = '';

      if (input.includes('<!--') && input.includes('-->')) {
        const parts = input.split('<!--');
        visibleText = parts[0].trim();
        for (let i = 1; i < parts.length; i++) {
          const sub = parts[i];
          if (sub.includes('-->')) {
            const [hidden, rest] = sub.split('-->');
            hiddenContent += hidden.trim() + ' ';
            visibleText += ' ' + rest.trim();
          }
        }
        visibleText = visibleText.trim();
      }

      resolve({
        visibleText,
        hiddenContent: hiddenContent.trim(),
        rawHash,
        metadata: {},
      });
    });
  });
}

/**
 * Extracts billing figures and passes through deterministic security engine
 * @param {object} docAnalysis 
 * @param {string} invoiceId 
 * @param {object} db 
 */
async function analyzeAndEvaluateInvoice(docAnalysis, invoiceId, db) {
  const { visibleText, hiddenContent } = docAnalysis;
  const normVisible = normalizeText(visibleText).normalized;

  // Extract visible amount (e.g. ₹2,000 or ₹5,000)
  let visibleAmount = 2000.00; // default baseline
  const amountMatch = normVisible.match(/(?:amount|due|inr|₹|rs\.?)\s*:?\s*(?:inr|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (amountMatch) {
    visibleAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Determine recipient
  let recipientId = 'REC_ELECTRICITY_BOARD';
  if (normVisible.toLowerCase().includes('water') || normVisible.toLowerCase().includes('mwc')) {
    recipientId = 'REC_WATER_DEPT';
  }

  const proposedAction = {
    actionType: 'PAYMENT',
    amount: visibleAmount,
    currency: 'INR',
    recipientId,
    sourceRefs: [invoiceId || 'INV_UPLOADED'],
    reason: `Payment for invoice ${invoiceId || ''}`,
  };

  // Evaluate strictly via deterministic policy engine
  const evaluation = await evaluatePolicy(proposedAction, {
    userId: 'USR_RAMESH_001',
    rawUserInput: visibleText,
    documentContext: {
      hiddenContent,
      visibleText,
    },
  }, db);

  return {
    invoiceId,
    visibleText,
    hiddenContent,
    visibleAmount,
    proposedAction,
    evaluation,
    isPoisoned: Boolean(hiddenContent && hiddenContent.length > 0),
  };
}

module.exports = {
  parseDocument,
  analyzeAndEvaluateInvoice,
};
