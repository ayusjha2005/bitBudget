const { normalizeText } = require('../../security/normalizer');

/**
 * Deterministic Mock AI Provider (FS-2605 Requirement)
 * Provides reliable, offline perceptual extraction for English, Hindi,
 * and Hinglish inputs, ensuring test reproducibility and offline operation.
 */
class MockProvider {
  constructor(options = {}) {
    this.name = 'mock-deterministic-v1';
    this.shouldFail = options.shouldFail || false;
  }

  setShouldFail(fail) {
    this.shouldFail = fail;
  }

  async generateResponse(userMessage, context = {}) {
    if (this.shouldFail) {
      throw new Error('Primary AI Provider service unreachable (503 Service Unavailable)');
    }

    const { normalized } = normalizeText(userMessage);
    const lower = normalized.toLowerCase();

    // 1. Social Engineering Scam Case (Section 10)
    if (lower.includes('frozen') || lower.includes('block') || lower.includes('band ho jayega') || lower.includes('25,000') || lower.includes('25000')) {
      return {
        rawOutput: JSON.stringify({
          actionType: 'PAYMENT',
          amount: 25000,
          currency: 'INR',
          recipientId: 'REC_UNKNOWN_SCAMMER',
          sourceRefs: ['INV_UNTRUSTED_MSG_99'],
          reason: 'Urgent transfer requested under account freeze coercion',
        }),
        explanation: 'User requested urgent transfer following coercive message.',
      };
    }

    // 2. High-value electricity bill case (₹22,000 or ₹25,000)
    if (lower.includes('25000') || lower.includes('22000') || lower.includes('commercial')) {
      const amount = lower.includes('22000') ? 22000 : 25000;
      return {
        rawOutput: JSON.stringify({
          actionType: 'PAYMENT',
          amount,
          currency: 'INR',
          recipientId: 'REC_ELECTRICITY_BOARD',
          sourceRefs: [lower.includes('22000') ? 'INV_HIGH_VAL_22000' : 'INV_HIGH_VAL_25000'],
          reason: 'Commercial electricity bill payment',
        }),
        explanation: `Proposed high-value payment of ₹${amount} for commercial electricity bill.`,
      };
    }

    // 3. Legitimate Electricity Bill Case (Section 11: English, Hindi, Hinglish)
    // Matches: "pay electricity", "bijli ka bill", "electricity bill", "pay bill", "2000"
    if (
      lower.includes('electricity') ||
      lower.includes('bijli') ||
      lower.includes('बिजली') ||
      lower.includes('bill') ||
      lower.includes('2000') ||
      lower.includes('2,000')
    ) {
      return {
        rawOutput: JSON.stringify({
          actionType: 'PAYMENT',
          amount: 2000,
          currency: 'INR',
          recipientId: 'REC_ELECTRICITY_BOARD',
          sourceRefs: ['INV_ELECTRICITY_2000'],
          reason: 'Electricity bill payment for August 2026',
        }),
        explanation: 'I found an active electricity bill of ₹2,000 for August 2026 from State Electricity Board. Proposing payment action.',
      };
    }

    // 4. Balance enquiry
    if (lower.includes('balance') || lower.includes('paise') || lower.includes('बैलेंस') || lower.includes('kitna')) {
      return {
        rawOutput: null,
        explanation: 'Your current verified account balance is ₹82,450.00 INR.',
      };
    }

    // 5. Default informational response
    return {
      rawOutput: null,
      explanation: 'I can assist you with paying verified utility bills, reviewing scanned invoices, or verifying your payment safety.',
    };
  }
}

module.exports = MockProvider;
