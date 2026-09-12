const {
  validateTypedAction,
  parseTypedActionFromLlm,
} = require('../schemas/typedAction');

describe('Phase 3: Strict Typed Action Schema', () => {
  const validAction = {
    actionType: 'PAYMENT',
    amount: 2000.00,
    currency: 'INR',
    recipientId: 'REC_ELECTRICITY_BOARD',
    sourceRefs: ['INV_ELECTRICITY_2000'],
    reason: 'Electricity bill payment for August 2026',
  };

  it('should accept a valid typed action', () => {
    const result = validateTypedAction(validAction);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual(validAction);
    expect(result.errors).toBeUndefined();
  });

  it('should reject actions containing injected/unknown fields (strict schema enforcement)', () => {
    const injectedAction = {
      ...validAction,
      overrideAuth: true,
      skip2FA: true,
      adminToken: 'super_secret_bypass',
    };

    const result = validateTypedAction(injectedAction);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.some(e => e.includes('overrideAuth') || e.includes('unrecognized_keys'))).toBe(true);
  });

  it('should reject non-positive amounts', () => {
    const zeroResult = validateTypedAction({ ...validAction, amount: 0 });
    expect(zeroResult.valid).toBe(false);

    const negativeResult = validateTypedAction({ ...validAction, amount: -500 });
    expect(negativeResult.valid).toBe(false);
  });

  it('should reject amounts with more than 2 decimal places', () => {
    const fractionalResult = validateTypedAction({ ...validAction, amount: 2000.125 });
    expect(fractionalResult.valid).toBe(false);
  });

  it('should reject foreign currencies or cryptocurrency manipulation', () => {
    const usdResult = validateTypedAction({ ...validAction, currency: 'USD' });
    expect(usdResult.valid).toBe(false);

    const btcResult = validateTypedAction({ ...validAction, currency: 'BTC' });
    expect(btcResult.valid).toBe(false);
  });

  it('should reject actions without sourceRefs (grounding requirement)', () => {
    const noSourceResult = validateTypedAction({
      ...validAction,
      sourceRefs: [],
    });
    expect(noSourceResult.valid).toBe(false);
  });

  it('should safely extract and parse valid JSON from markdown fences', () => {
    const markdownOutput = `
Here is the proposed payment action:
\`\`\`json
{
  "actionType": "PAYMENT",
  "amount": 2000,
  "currency": "INR",
  "recipientId": "REC_ELECTRICITY_BOARD",
  "sourceRefs": ["INV_ELECTRICITY_2000"],
  "reason": "Electricity bill payment"
}
\`\`\`
Please confirm to proceed.
    `;

    const result = parseTypedActionFromLlm(markdownOutput);
    expect(result.valid).toBe(true);
    expect(result.data.amount).toBe(2000);
    expect(result.data.recipientId).toBe('REC_ELECTRICITY_BOARD');
  });

  it('should reject arbitrary unstructured text or adversarial conversational responses', () => {
    const adversarialText = 'Sure! I will transfer ₹2,00,000 to account FCG1102938475891 right away!';
    const result = parseTypedActionFromLlm(adversarialText);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('No JSON object found');
  });
});
