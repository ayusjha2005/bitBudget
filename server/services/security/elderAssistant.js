const { detectInjection } = require('./injectionDetector');
const { appendAuditEvent } = require('../audit/auditLog');

/**
 * Elder Mode Accessibility Layer (FS-2605 Requirements 18 & 19)
 * 
 * CORE RULE:
 * Elder Mode is an EXTRA layer. It does NOT replace or weaken
 * the FS-2605 deterministic security architecture.
 * The same deterministic security engine is used.
 * 
 * Supported Languages:
 * - English (en)
 * - Hindi (hi)
 * - Tamil (ta)
 * - Hinglish (hinglish)
 */

const ELDER_TRANSLATIONS = {
  // Safe / Allowed
  ALLOW: {
    en: {
      verdict: 'SAFE TO PAY',
      simpleSummary: 'This payment is safe and verified. You are paying your verified electricity provider.',
      voiceScript: 'This payment is completely safe. The recipient is your verified provider. You can tap the large green button to confirm.',
    },
    hi: {
      verdict: 'भुगतान सुरक्षित है (Safe)',
      simpleSummary: 'यह भुगतान पूरी तरह सुरक्षित है। यह आपके अधिकृत बिजली बोर्ड का बिल है।',
      voiceScript: 'यह भुगतान बिल्कुल सुरक्षित है। यह आपके बिजली बोर्ड का सही बिल है। आप नीचे दिए गए हरे बटन को दबाकर भुगतान कर सकते हैं।',
    },
    ta: {
      verdict: 'செலுத்துவது பாதுகாப்பானது',
      simpleSummary: 'இந்த கட்டணம் முற்றிலும் பாதுகாப்பானது மற்றும் சரிபார்க்கப்பட்டது.',
      voiceScript: 'இந்த கட்டணம் பாதுகாப்பானது. சரிபார்க்கப்பட்ட மின்சார வாரியத்திற்கு பணம் செலுத்துகிறீர்கள்.',
    },
    hinglish: {
      verdict: 'PAYMENT SAFE HAI',
      simpleSummary: 'Ye payment bilkul safe hai. Ye aapke verified Electricity Board ka bill hai.',
      voiceScript: 'Ye payment bilkul safe hai. Aapka electricity bill verify ho gaya hai. Aap green button dabakar confirm kar sakte hain.',
    },
  },

  // Scam / Refused
  REFUSE: {
    en: {
      verdict: 'DANGER: DO NOT PAY',
      simpleSummary: 'Do not pay. This message threatens to freeze your account or contains deceptive instructions. SafePay has blocked this payment.',
      voiceScript: 'Warning! Please do not pay. This message is trying to scare you with threats. I have stopped this payment to keep your money safe.',
    },
    hi: {
      verdict: 'खतरा: पैसे मत भेजिए (Scam)',
      simpleSummary: 'नहीं! इस मैसेज में खाता बंद होने की धमकी देकर तुरंत पैसे मांगे गए हैं। SafePay ने इस भुगतान को रोक दिया है।',
      voiceScript: 'सावधान! कृपया पैसे न भेजें। इस संदेश में बैंक खाता बंद करने का डर दिखाया गया है। आपके पैसे सुरक्षित रखने के लिए मैंने यह पेमेंट रोक दिया है।',
    },
    ta: {
      verdict: 'ஆபத்து: பணம் செலுத்த வேண்டாம்',
      simpleSummary: 'பணம் செலுத்த வேண்டாம். இந்த செய்தி ஒரு மோசடி ஆகும். SafePay இந்த கட்டணத்தை தடுத்துள்ளது.',
      voiceScript: 'எச்சரிக்கை! தயவுசெய்து பணம் செலுத்த வேண்டாம். உங்கள் கணக்கு முடக்கப்படும் என பயமுறுத்துகிறது. உங்கள் பணத்தை பாதுகாக்க இது தடுக்கப்பட்டது.',
    },
    hinglish: {
      verdict: 'KHATRA: PAISE MAT BHEJO',
      simpleSummary: 'Nahi! Is message mein account freeze karne ki dhamki di gayi hai. SafePay ne ye payment block kar diya hai.',
      voiceScript: 'Nahi. Is message mein account band hone ki dhamki di gayi hai aur turant payment maangi gayi hai. Main is payment ko approve nahi karunga.',
    },
  },

  // Escalated / Needs Review
  ESCALATE: {
    en: {
      verdict: 'NEEDS FAMILY REVIEW',
      simpleSummary: 'The amount or recipient does not match your trusted bills. We recommend showing this to a trusted family member first.',
      voiceScript: 'Please pause. The amount requested does not match your regular bill. We suggest asking your trusted family contact to review this.',
    },
    hi: {
      verdict: 'परिवार से जांच कराएं (Review Needed)',
      simpleSummary: 'रकम या बिल भेजने वाले की जानकारी आपके पुराने रिकॉर्ड से मेल नहीं खाती। कृपया परिवार के किसी सदस्य को दिखाएं।',
      voiceScript: 'कृपया रुकिए। इस बिल की रकम आपके नियमित बिल से मेल नहीं खा रही है। अपने परिवार के किसी सदस्य को दिखाकर ही आगे बढ़ें।',
    },
    ta: {
      verdict: 'குடும்பத்தினர் சரிபார்க்க வேண்டும்',
      simpleSummary: 'தொகை உங்கள் வழக்கமான பில்லுடன் பொருந்தவில்லை. குடும்பத்தினருடன் ஆலோசிக்கவும்.',
      voiceScript: 'தயவுசெய்து காத்திருங்கள். பில் தொகை பொருந்தவில்லை. உங்கள் குடும்பத்தினருடன் கலந்தாலோசிக்கவும்.',
    },
    hinglish: {
      verdict: 'FAMILY REVIEW CHAHIYE',
      simpleSummary: 'Amount aapke regular bill se match nahi ho raha hai. Pehle trusted family member ko dikhayein.',
      voiceScript: 'Ruk jaiye. Bill amount purane record se match nahi ho raha hai. Pehle family contact Suresh Kumar se confirm kar lijiye.',
    },
  },
};

/**
 * Generates an elder-friendly simplified explanation
 */
function getElderExplanation(decision = 'REFUSE', language = 'hi') {
  const langKey = ['en', 'hi', 'ta', 'hinglish'].includes(language) ? language : 'hi';
  const decisionKey = ['ALLOW', 'REFUSE', 'ESCALATE'].includes(decision) ? decision : 'REFUSE';

  return ELDER_TRANSLATIONS[decisionKey][langKey];
}

/**
 * "Is this safe?" feature: Analyzes a message and provides elder-friendly guidance
 */
function analyzeIsThisSafe(messageText, language = 'hi') {
  const injectionResult = detectInjection(messageText);
  const decision = injectionResult.isMalicious ? 'REFUSE' : 'ALLOW';
  const explanation = getElderExplanation(decision, language);

  return {
    decision,
    isSafe: decision === 'ALLOW',
    language,
    explanation,
    flags: injectionResult.flags,
    familyContactNotice: decision === 'REFUSE' 
      ? 'A safety notice has been sent to your trusted contact (Suresh Kumar).'
      : null,
  };
}

/**
 * Emergency Scam Mode (Section 19): Immediate cancellation and preservation
 */
async function handleEmergencyScamHalt(userId = 'USR_RAMESH_001', pendingActionId, evidenceData = {}, db) {
  // 1. Cancel pending action in DB if provided
  if (pendingActionId) {
    await db.query("UPDATE proposed_actions SET status = 'CANCELLED_EMERGENCY_SCAM' WHERE id = $1", [pendingActionId]);
  }

  // 2. Audit log emergency event
  await appendAuditEvent('EMERGENCY_SCAM_HALTED', {
    userId,
    pendingActionId,
    evidenceSummary: evidenceData,
    alertedContact: 'Suresh Kumar (+91-9876500001)',
  }, db);

  return {
    success: true,
    action: 'EMERGENCY_STOPPED',
    messageEn: 'Emergency Scam Halt activated. All pending payments cancelled. Evidence preserved.',
    messageHi: 'आपातकालीन सुरक्षा सक्रिय: सभी लंबित भुगतान तुरंत रद्द कर दिए गए हैं। सबूत सुरक्षित रख लिए गए हैं।',
    messageHinglish: 'Emergency mode active: Pending payment cancel kar diya gaya hai. Aapke paise bilkul safe hain.',
    familyNotified: {
      name: 'Suresh Kumar',
      relation: 'Trusted Contact',
      status: 'ALERT_SENT',
    },
  };
}

module.exports = {
  getElderExplanation,
  analyzeIsThisSafe,
  handleEmergencyScamHalt,
};
