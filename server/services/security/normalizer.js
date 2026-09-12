/**
 * Deterministic Input Normalizer (FS-2605 Requirement)
 * Strips zero-width characters, normalizes Unicode (NFKC),
 * collapses whitespace, and standardizes multilingual/code-switched phrases.
 */

// Regex for zero-width / invisible Unicode characters
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u00A0\u200E\u200F\u202A-\u202E]/g;

// Multilingual token mappings for security-relevant phrases
const MULTILINGUAL_TOKEN_MAP = [
  // Ignore instructions
  { pattern: /(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|system|your|internal)\s+(instructions|prompts|rules)/i, canonical: 'INJECTION_IGNORE_INSTRUCTIONS' },
  { pattern: /(dump|reveal|show|leak)\s+(your\s+)?(system\s+prompt|internal\s+instructions|secret)/i, canonical: 'INJECTION_IGNORE_INSTRUCTIONS' },
  { pattern: /(पिछले|सारे|पूर्व)\s+(निर्देशों|आदेशों|नियमों)\s+को\s+(अनदेखा|नज़रअंदाज़|रद्द)\s+करो/i, canonical: 'INJECTION_IGNORE_INSTRUCTIONS' },
  { pattern: /(previous|prior|system)\s+(instructions|rules)\s+(ignore|karo|batao)/i, canonical: 'INJECTION_IGNORE_INSTRUCTIONS' },

  // Role escalation / fake system
  { pattern: /(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(system|admin|root|god\s+mode|developer)/i, canonical: 'INJECTION_ROLE_ESCALATION' },
  { pattern: /<\|im_start\|>system|\[SYSTEM\]|###\s*SYSTEM\s*PROMPT/i, canonical: 'INJECTION_FAKE_SYSTEM' },

  // Fake confirmation
  { pattern: /(user|admin)\s+(has\s+already\s+)?(confirmed|authorized|approved)\s+this/i, canonical: 'INJECTION_FAKE_CONFIRMATION' },
  { pattern: /(bypass|skip)\s+(confirmation|2fa|otp|verification)/i, canonical: 'INJECTION_BYPASS_ATTEMPT' },

  // Urgent social engineering threats
  { pattern: /(account|bank|card)\s+(will\s+be\s+|is\s+being\s+)?(frozen|blocked|suspended|deactivated|closed)/i, canonical: 'SCAM_URGENT_FREEZE_THREAT' },
  { pattern: /(freeze|block|suspend|close)\s+(your\s+)?(account|bank|card)/i, canonical: 'SCAM_URGENT_FREEZE_THREAT' },
  { pattern: /(pay|transfer).*(immediately|urgently|turant).*(frozen|freeze|blocked|closed|legal|police)/i, canonical: 'SCAM_URGENT_FREEZE_THREAT' },
  { pattern: /(खाता|बैंक|कार्ड)\s+(फ्रीज|बंद|ब्लॉक)\s+(हो\s+जाएगा|कर\s+दिया\s+जाएगा)/i, canonical: 'SCAM_URGENT_FREEZE_THREAT' },
  { pattern: /(account\s+freeze|band\s+ho\s+jayega|turant\s+bhejo)/i, canonical: 'SCAM_URGENT_FREEZE_THREAT' },
];

/**
 * Normalizes text deterministically:
 * 1. NFKC Unicode normalization
 * 2. Strip invisible characters
 * 3. Collapse whitespace
 * 4. Return original, cleaned, and matched security tokens
 */
function normalizeText(input) {
  if (!input || typeof input !== 'string') {
    return {
      original: '',
      normalized: '',
      hasInvisibleChars: false,
      detectedTokens: [],
    };
  }

  const hasInvisibleChars = INVISIBLE_CHARS_REGEX.test(input);

  // 1. Unicode NFKC normalization
  let normalized = input.normalize('NFKC');

  // 2. Strip invisible characters
  normalized = normalized.replace(INVISIBLE_CHARS_REGEX, ' ');

  // 3. Normalize multiple whitespace and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // 4. Scan for canonical multilingual security tokens
  const detectedTokens = [];
  for (const item of MULTILINGUAL_TOKEN_MAP) {
    if (item.pattern.test(normalized)) {
      if (!detectedTokens.includes(item.canonical)) {
        detectedTokens.push(item.canonical);
      }
    }
  }

  return {
    original: input,
    normalized,
    hasInvisibleChars,
    detectedTokens,
  };
}

module.exports = {
  normalizeText,
};
