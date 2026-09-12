require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Database & Supabase
  databaseUrl: process.env.DATABASE_URL || '',
  useEmbeddedPostgres: process.env.USE_EMBEDDED_POSTGRES !== 'false',
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  },

  // Secrets & Signing
  actionSigningSecret: process.env.ACTION_SIGNING_SECRET || 'safepay_dev_action_signing_secret_994827419',
  jwtSecret: process.env.JWT_SECRET || 'safepay_jwt_secret_dev_38291048201',

  // Financial Limits (in INR)
  limits: {
    normalMax: parseFloat(process.env.LIMIT_NORMAL_MAX || '5000'),
    newRecipientMax: parseFloat(process.env.LIMIT_NEW_RECIPIENT_MAX || '3000'),
    highValueThreshold: parseFloat(process.env.LIMIT_HIGH_VALUE_THRESHOLD || '20000'),
  },

  // AI Configuration
  ai: {
    primaryProvider: process.env.PRIMARY_PROVIDER || 'mock',
    fallbackProvider: process.env.FALLBACK_PROVIDER || 'mock',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    simulateOffline: process.env.AI_SIMULATE_OFFLINE === 'true',
  },

  // Security Flags
  enableAuditVerificationOnBoot: process.env.ENABLE_AUDIT_VERIFICATION_ON_BOOT !== 'false',
};

module.exports = config;
