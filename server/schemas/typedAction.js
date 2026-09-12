const { z } = require('zod');

/**
 * Strict Typed Action Schema (FS-2605 Requirement)
 * Any unknown keys or invalid types cause immediate rejection.
 * The model output MUST NOT be executed directly.
 */
const TypedActionSchema = z.object({
  actionType: z.enum(['PAYMENT', 'QUERY_BALANCE', 'EMERGENCY_HALT'], {
    errorMap: () => ({ message: "actionType must be one of: 'PAYMENT', 'QUERY_BALANCE', 'EMERGENCY_HALT'" }),
  }),
  amount: z.number({
    required_error: "Amount is required and must be a valid number",
    invalid_type_error: "Amount must be a number",
  })
  .positive("Amount must be strictly greater than 0")
  .max(10000000, "Amount exceeds system absolute safety threshold (₹1,00,00,000)")
  .refine(val => Number.isFinite(val), "Amount must be finite")
  .refine(val => Math.round(val * 100) === val * 100, "Amount cannot have more than 2 decimal places"),
  currency: z.literal('INR', {
    errorMap: () => ({ message: "Currency must strictly be 'INR'. Foreign currencies or crypto are disallowed." }),
  }),
  recipientId: z.string({
    required_error: "recipientId is required",
  })
  .min(3, "recipientId must be at least 3 characters")
  .max(64, "recipientId must not exceed 64 characters")
  .regex(/^[A-Za-z0-9_-]+$/, "recipientId must contain only alphanumeric characters, underscores, or hyphens"),
  sourceRefs: z.array(z.string().min(1).max(128), {
    required_error: "sourceRefs is required to satisfy grounding policy",
  })
  .min(1, "sourceRefs must contain at least one trusted source reference (e.g. invoice or user instruction ID)"),
  reason: z.string({
    required_error: "reason is required",
  })
  .min(2, "reason must be at least 2 characters")
  .max(255, "reason must not exceed 255 characters")
  .transform(val => val.trim()),
}).strict(); // CRITICAL: Reject any unknown fields (e.g., bypass_auth, override_limit, is_confirmed)

/**
 * Validates an action payload against the strict schema
 * @param {object} rawAction - Candidate action object
 * @returns {{ valid: boolean, data?: object, errors?: string[] }}
 */
function validateTypedAction(rawAction) {
  if (!rawAction || typeof rawAction !== 'object') {
    return {
      valid: false,
      errors: ['Action payload must be a non-null JSON object'],
    };
  }

  const result = TypedActionSchema.safeParse(rawAction);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map(
      err => `${(err.path && err.path.join('.')) || 'root'}: ${err.message}`
    );
    return {
      valid: false,
      errors: errorMessages,
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

/**
 * Safely parses LLM text response into a validated Typed Action
 * Strips markdown code blocks (```json ... ```), verifies JSON structure,
 * and passes through the strict Zod schema.
 * @param {string} llmOutput - Raw string from model
 * @returns {{ valid: boolean, data?: object, errors?: string[] }}
 */
function parseTypedActionFromLlm(llmOutput) {
  if (!llmOutput || typeof llmOutput !== 'string') {
    return {
      valid: false,
      errors: ['LLM output was empty or not a string'],
    };
  }

  try {
    // 1. Strip markdown fences if present
    let cleaned = llmOutput.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }

    // 2. Find outermost JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return {
        valid: false,
        errors: ['No JSON object found in model output'],
      };
    }

    const jsonSubstr = cleaned.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonSubstr);

    // 3. Validate against strict schema
    return validateTypedAction(parsed);
  } catch (err) {
    return {
      valid: false,
      errors: [`JSON parse error from untrusted model text: ${err.message}`],
    };
  }
}

module.exports = {
  TypedActionSchema,
  validateTypedAction,
  parseTypedActionFromLlm,
};
