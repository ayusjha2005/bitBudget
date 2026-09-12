-- SafePay AI (FS-2605) Database Schema
-- Compatible with PostgreSQL 14+ and PGlite

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(32),
    preferred_language VARCHAR(32) DEFAULT 'en', -- en, hi, ta, hinglish
    status VARCHAR(32) DEFAULT 'ACTIVE', -- ACTIVE, LOCKED, RECOVERING
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    account_number VARCHAR(64) UNIQUE NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(8) DEFAULT 'INR',
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Recipients (Whitelisted directory)
CREATE TABLE IF NOT EXISTS recipients (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    category VARCHAR(64) DEFAULT 'UTILITY', -- UTILITY, GOVERNMENT, MERCHANT, PERSONAL
    is_verified BOOLEAN DEFAULT FALSE,
    risk_score DECIMAL(4, 2) DEFAULT 0.00, -- 0.00 (safe) to 1.00 (critical)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Invoices & Document Evidence
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    recipient_id VARCHAR(64) REFERENCES recipients(id),
    invoice_number VARCHAR(128),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    status VARCHAR(32) DEFAULT 'PENDING', -- PENDING, VERIFIED, POISONED, PAID
    visible_content TEXT,
    hidden_content TEXT, -- Captured invisible or metadata instructions
    raw_document_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Proposed Actions (Generated strictly by untrusted LLM proposal)
CREATE TABLE IF NOT EXISTS proposed_actions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    action_type VARCHAR(64) NOT NULL, -- PAYMENT, TRANSFER, BALANCE_CHECK
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    recipient_id VARCHAR(64),
    source_refs TEXT, -- JSON array string of trusted source IDs (e.g. ["INV_123"])
    reason TEXT,
    raw_llm_output TEXT,
    status VARCHAR(32) DEFAULT 'PENDING', -- PENDING, ALLOWED, REFUSED, ESCALATED, EXECUTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Security Decisions (Produced strictly by deterministic policy engine)
CREATE TABLE IF NOT EXISTS security_decisions (
    id VARCHAR(64) PRIMARY KEY,
    proposed_action_id VARCHAR(64) NOT NULL REFERENCES proposed_actions(id),
    decision VARCHAR(32) NOT NULL, -- ALLOW, REFUSE, ESCALATE
    internal_state VARCHAR(32), -- REQUIRE_2FA, USER_CONFIRMATION_PENDING, NORMAL_ALLOW
    reasons TEXT, -- JSON array string of rationale items
    risk_indicators TEXT, -- JSON array string of detected flags
    rule_results TEXT, -- JSON object of individual rule determinations
    action_token TEXT, -- Signed deterministic token issued only on ALLOW
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Transactions (Executed by Payment Simulator ONLY upon validated token)
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    proposed_action_id VARCHAR(64) NOT NULL REFERENCES proposed_actions(id),
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(id),
    recipient_id VARCHAR(64) NOT NULL REFERENCES recipients(id),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    status VARCHAR(32) NOT NULL, -- SUCCESS, FAILED, SIMULATED
    simulation_note TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Audit Logs (Tamper-evident SHA-256 Hash Chain)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(64) UNIQUE NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    event_data TEXT NOT NULL, -- Canonical JSON string
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Recovery Requests (2-of-3 Device Loss Protocol)
CREATE TABLE IF NOT EXISTS recovery_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    factor_a_otp_verified BOOLEAN DEFAULT FALSE,
    factor_b_contact_verified BOOLEAN DEFAULT FALSE,
    factor_c_key_verified BOOLEAN DEFAULT FALSE,
    trusted_contact_id VARCHAR(64),
    status VARCHAR(32) DEFAULT 'PENDING', -- PENDING, COMPLETED, REJECTED, EXPIRED
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Privacy Proofs (Predicate Range Proofs)
CREATE TABLE IF NOT EXISTS proofs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    proof_type VARCHAR(64) NOT NULL, -- PREDICATE_BALANCE_GE
    predicate VARCHAR(255) NOT NULL, -- e.g. "balance >= 50000"
    public_inputs TEXT NOT NULL, -- JSON string
    proof_data TEXT NOT NULL, -- JSON string with commitment and witness proof
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
