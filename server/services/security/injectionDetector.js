const { normalizeText } = require('./normalizer');

/**
 * Deterministic Injection and Anomaly Detector (FS-2605 Requirement)
 * Does NOT rely on the LLM to detect attacks.
 * Uses deterministic pattern matching, token mapping, and structural analysis.
 */
function detectInjection(inputText, documentContext = {}) {
  const normResult = normalizeText(inputText);
  const flags = [...normResult.detectedTokens];
  const reasons = [];

  // Check 1: Invisible character tampering
  if (normResult.hasInvisibleChars) {
    flags.push('ANOMALY_INVISIBLE_CHARS');
    reasons.push('Document or input contains hidden zero-width/invisible Unicode characters.');
  }

  // Check 2: Instruction overrides
  if (flags.includes('INJECTION_IGNORE_INSTRUCTIONS')) {
    reasons.push('Detected attempt to override system instructions or ignore prior security policies.');
  }

  // Check 3: Role escalation / Jailbreak
  if (flags.includes('INJECTION_ROLE_ESCALATION')) {
    reasons.push('Detected attempt to claim administrative or system privileges.');
  }

  // Check 4: Fake system prompt markers
  if (flags.includes('INJECTION_FAKE_SYSTEM')) {
    reasons.push('Detected fake system boundary markers or prompt injection formatting.');
  }

  // Check 5: Fake confirmation bypass
  if (flags.includes('INJECTION_FAKE_CONFIRMATION') || flags.includes('INJECTION_BYPASS_ATTEMPT')) {
    reasons.push('Detected attempt to bypass mandatory user confirmation or two-factor authentication.');
  }

  // Check 6: Urgent social engineering threats
  if (flags.includes('SCAM_URGENT_FREEZE_THREAT')) {
    reasons.push('Detected urgent coercion or threat pattern (e.g. fraudulent account-freeze threat).');
  }

  // Check 7: Hidden document instructions in metadata or invisible layers
  if (documentContext && documentContext.hiddenContent) {
    const hiddenNorm = normalizeText(documentContext.hiddenContent);
    if (hiddenNorm.detectedTokens.length > 0 || hiddenNorm.normalized.length > 10) {
      flags.push('INJECTION_HIDDEN_PDF_INSTRUCTION');
      reasons.push('Document contains hidden/invisible instructions that do not appear in visible billing content.');
    }
  }

  const isMalicious = flags.some(f =>
    f.startsWith('INJECTION_') || f === 'SCAM_URGENT_FREEZE_THREAT'
  );

  return {
    detected: flags.length > 0,
    isMalicious,
    flags,
    reasons,
    normalized: normResult.normalized,
  };
}

module.exports = {
  detectInjection,
};
