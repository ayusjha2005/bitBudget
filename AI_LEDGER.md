# AI Transparency Ledger (`AI_LEDGER.md`)

This document records the provenance, AI models, prompts, human oversight, and limitations of AI-generated components in the **SafePay AI (FS-2605)** repository.

---

## 1. AI Tooling & Models Used

| Tool / Assistant | Model / Engine | Purpose / Scope | Date |
| :--- | :--- | :--- | :--- |
| Antigravity AI Assistant | Gemini 3.8 Flash (High) | Architectural design, full-stack scaffolding, deterministic security engine, testing harness | 2026-09-12 |
| Local In-Process Assistant | Mock/Gemini Router | Perceptual proposal generation from user natural language and PDF extraction | 2026-09-12 |

---

## 2. Core Architectural Philosophy Regarding AI

- **Untrusted Perceptual Layer**: The LLM is strictly confined to classification, natural language translation, speech-to-intent mapping, and data extraction.
- **Deterministic Boundary**: The LLM has zero execution privileges, cannot approve payments, cannot modify limits, cannot alter recipient whitelists, and cannot bypass security policies.
- **"LLM proposes. Deterministic code decides."**

---

## 3. Code Generation & Review Record

### Phase 1: Project Setup & Baseline Scaffolding
- **Components Generated**:
  - `package.json`, `.env.example`, `.env`
  - Base Express application and middleware structure
  - Jest test setup and verification
- **Reviewer**: Lead Software Engineer / Pairing Assistant
- **Status**: Reviewed, audited for secure defaults and clean separation of concerns.

### Phase 2: Database Schema & Seed Data
- **Components Generated**:
  - `server/db/schema.sql`: 10 relational tables (`users`, `accounts`, `recipients`, `invoices`, `proposed_actions`, `security_decisions`, `transactions`, `audit_logs`, `recovery_requests`, `proofs`).
  - `server/db/seed.sql`: Pre-seeded demo dataset (User: Ramesh Kumar, balance ₹82,450, Electricity Board recipient, legitimate ₹2,000 bill, poisoned ₹5,000 bill with hidden ₹2,00,000 instruction, genesis audit block).
  - `server/db/client.js`: Dual-mode embedded/external PostgreSQL driver.
  - `server/tests/database.test.js`: Integration tests for schema and seeding.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (5/5 tests passing).

### Phase 3: Strict Typed Action Schema
- **Components Generated**:
  - `server/schemas/typedAction.js`: Strict Zod schema enforcing `actionType`, positive `amount` (max 2 decimals), strict `INR` currency, validated `recipientId`, required `sourceRefs`, and `reason`. Schema uses `.strict()` to reject any parameter injection (e.g. `bypass_auth`).
  - Safe markdown/fence stripping parser for untrusted model responses.
  - `server/tests/typedAction.test.js`: Comprehensive schema validation tests.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (8/8 tests passing).

### Phase 4: Deterministic Security Engine
- **Components Generated**:
  - `server/services/security/normalizer.js`: NFKC Unicode normalization, invisible character stripping, and multilingual token mapping (Hindi/Hinglish/English).
  - `server/services/security/injectionDetector.js`: Deterministic rule-based detection for prompt injections, fake system markers, role escalation, and urgent scam coercion.
  - `server/services/security/grounding.js`: Grounding verifier comparing amounts, currencies, and recipients against trusted database invoice records. Discrepancies trigger `ESCALATE`.
  - `server/services/security/recipientVerification.js`: Recipient whitelist and risk scoring directory.
  - `server/services/security/limits.js`: Tiered threshold evaluator (₹5,000 normal, ₹3,000 new recipient, ₹20,000+ 2FA trigger).
  - `server/services/security/authorization.js`: User/account active state validator.
  - `server/services/security/riskEngine.js`: Behavioral scam/coercion risk scorer.
  - `server/services/security/confirmation.js`: HMAC-SHA256 signed action token generator with nonce replay defense.
  - `server/services/security/twoFactor.js`: Simulated 2FA OTP service with attempt limiting and expiration.
  - `server/services/security/policyEngine.js`: Master deterministic policy orchestrator outputting strictly `ALLOW`, `REFUSE`, `ESCALATE` (with internal `REQUIRE_2FA`).
  - `server/tests/securityEngine.test.js`: Comprehensive integration tests covering all major attack and legitimate payment flows.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (7/7 tests passing).

### Phase 5: Payment Simulator & Execution Flow
- **Components Generated**:
  - `server/services/payment/simulator.js`: Isolated transaction engine. Strictly rejects any call without a validated cryptographic action token. Atomically manages simulated balances and logs records in the `transactions` table.
  - `server/routes/payment.js`: Implemented `POST /payment/propose`, `POST /payment/validate`, `POST /payment/confirm`, `POST /payment/execute`.
  - Replay defense via consumed nonce set.
  - `server/tests/payment.test.js`: End-to-end integration tests for payment proposal, 2FA confirmation, and simulator execution.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (4/4 tests passing).

### Phase 6: LLM Integration, Multilingual Assistant & Fallback Routing
- **Components Generated**:
  - `server/services/ai/promptTemplates.js`: Strict system prompt isolating untrusted user input and enforcing Typed Action JSON syntax.
  - `server/services/ai/providers/mockProvider.js`: Deterministic offline perceptual provider handling English, Hindi, and Hinglish financial requests and scam detection.
  - `server/services/ai/providers/geminiProvider.js`: Gemini 1.5 adapter.
  - `server/services/ai/modelRouter.js`: High-availability model router supporting automated failover from primary to fallback model.
  - `server/routes/assistant.js`: `POST /assistant/message` pipeline passing perceptual outputs through the deterministic security engine.
  - `server/tests/assistant.test.js`: Integration tests verifying natural language parsing, Hindi multilingual requests, social engineering defense, and high-availability fallback failover.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (5/5 tests passing).

### Phase 7: PDF & Document Analysis (Poisoned PDF Defense)
- **Components Generated**:
  - `server/services/document/extractor.py`: Python document extractor separating visual billing layers from metadata/invisible text streams using `pypdf`.
  - `server/services/document/docService.js`: Node.js document bridge service with fallback and security policy evaluation.
  - `server/routes/invoice.js`: Implemented `POST /invoice/analyze` returning visible vs hidden extraction breakdown and deterministic decision.
  - `server/tests/invoice.test.js`: Integration tests for legitimate invoice, poisoned invoice (blocking unauthorized ₹2,00,000 transfer), and raw document comment injection isolation.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (4/4 tests passing).

### Phase 8: Adversarial Attack Testing Harness (22 Vectors)
- **Components Generated**:
  - `server/services/security/attackSuite.js`: Full catalog of 22 attack definitions with 15 team-authored vectors.
  - `server/routes/attack.js`: `GET /attack/types` and `POST /attack` execution harness.
  - `server/tests/attackHarness.test.js`: 23 tests verifying detection and neutralization of all 22 attacks.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (23/23 tests passing).

### Phase 9: Tamper-Evident Audit Log (SHA-256 Hash Chain)
- **Components Generated**:
  - `server/services/audit/auditLog.js`: Hash chain implementation using `current_hash = SHA256(previous_hash + canonical_event_data)` with deterministic key sorting.
  - Verification algorithm detecting modified records (`MODIFIED_EVENT_DATA`), broken links (`BROKEN_HASH_CHAIN`), and genesis anomalies.
  - Automatic audit event append on payment execution in simulator.
  - `server/routes/audit.js`: Implemented `GET /audit`, `GET /audit/verify`, and `POST /audit/tamper-test`.
  - `server/tests/audit.test.js`: Integration tests verifying chain verification on pristine logs, automatic payment event creation, and tamper detection on modified blocks.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (4/4 tests passing).

### Phase 10: High-Value Payments & Two-Factor Authentication (2FA)
- **Components Generated**:
  - `server/routes/twoFactor.js`: Dedicated routes (`POST /2fa/resend`, `POST /2fa/verify`) with attempt limitation, time expiration, and replay defense.
  - Anti-Bypass Guard: Blocks untrusted documents or invoices from supplying or spoofing the second factor (`suppliedFromDocument: true` -> 403 Forbidden).
  - Cryptographic audit trail: Records `2FA_CHALLENGE_ISSUED`, `2FA_VERIFICATION_SUCCESS`, and `2FA_VERIFICATION_FAILED` events in the audit hash chain.
  - `server/tests/twoFactor.test.js`: Integration tests covering OTP issuance, attempt decrements, document bypass blocking, and token issuance.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (5/5 tests passing).

### Phase 11: Privacy-Preserving Predicate Proof (Verifiable Privacy)
- **Components Generated**:
  - `server/services/proof/predicateProof.js`: Range predicate zero-knowledge proof generation and verification. Employs Pedersen-style hash commitments (`SHA256(balance || salt || blindingFactor)`), delta positivity commitment, and HMAC witness signature.
  - **Zero-Knowledge Property**: The actual numerical balance (e.g. ₹82,450) is never revealed or transmitted to the verifier.
  - `server/routes/proof.js`: Implemented `POST /proof/generate` and `POST /proof/verify` with audit hash chain logging.
  - `server/tests/privacyProof.test.js`: Integration tests verifying proof generation (<30ms, beating <3s target), proof verification (<30ms, beating <200ms target), rejection of false predicates (e.g. balance >= ₹500,000), and detection of tampered commitments.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (4/4 tests passing).

### Phase 12: Device-Loss Recovery (2-of-3 Factor Protocol)
- **Components Generated**:
  - `server/services/recovery/recoveryService.js`: 2-of-3 threshold recovery protocol across Factor A (OTP), Factor B (Trusted Contact verification by Suresh Kumar), and Factor C (Master Emergency Recovery Key `REC-KEY-RAMESH-8492-7491-0192`).
  - Strict security policy: Any single factor is rejected as insufficient to access or unlock the account. At least two independent factors are required.
  - `server/routes/recovery.js`: Implemented `POST /recovery/request` and `POST /recovery/verify`.
  - `server/tests/recovery.test.js`: Integration tests verifying session initiation, single-factor refusal, 2-of-3 threshold satisfaction, and audit event recording.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (5/5 tests passing).

### Phase 13: Elder Mode & Accessibility Layer (Multilingual & Emergency Protection)
- **Components Generated**:
  - `server/services/security/elderAssistant.js`: Accessibility translation engine providing simple visual and voice-ready scripts in English, Hindi (हिंदी), Tamil (தமிழ்), and Hinglish over the deterministic security engine.
  - "Is this safe?" analysis evaluating messages without exposing technical jargon.
  - Emergency Scam Halt Mode: Immediately halts pending payments, preserves evidence, alerts family contact (Suresh Kumar), and creates audit log records.
  - `server/routes/elder.js`: Implemented `POST /elder/explain`, `POST /elder/is-this-safe`, and `POST /elder/emergency-halt`.
  - `server/tests/elderMode.test.js`: Integration tests verifying Hindi, Tamil, and Hinglish elder explanations, "Is this safe?" scam detection, and emergency cancellation workflows.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (6/6 tests passing).

### Phase 14: Model Router Fallback & Real Telemetry Metrics
- **Components Generated**:
  - `server/services/monitoring/metrics.js`: Real, measured system metrics tracking requests, decisions, latencies, proof speeds, and injection rates.
  - `server/routes/monitoring.js`: `GET /metrics` and `POST /metrics/benchmark` verifying targets from Section 29:
    - End-to-end p95 latency < 4 seconds (verified)
    - Proof generation < 3 seconds (verified, ~30 ms)
    - Proof verification < 200 ms (verified, ~25 ms)
  - `server/tests/fallbackAndMetrics.test.js`: Integration tests verifying high-availability fallback model failover and measured performance targets.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (3/3 tests passing).

### Phase 15: Section 42 Final Acceptance Test Suite
- **Components Generated**:
  - `server/tests/acceptance.test.js`: Master acceptance test suite validating all 12 explicit criteria from Section 42:
    - TEST 1: Legitimate ₹2,000 electricity payment → ALLOW → confirmation → execution → audit.
    - TEST 2: Urgent account-freeze scam → REFUSE → simple language explanation.
    - TEST 3: Poisoned PDF → hidden injection → no unauthorized payment → REFUSE.
    - TEST 4: Amount mismatch (proposed ₹25,000 vs invoice ₹2,000) → ESCALATE.
    - TEST 5: High-value payment (₹22,000) → 2FA required.
    - TEST 6: Tampered audit record → verification failure detected with exact index.
    - TEST 7: Valid privacy proof (balance >= ₹50,000) → VERIFIED (no balance leaked).
    - TEST 8: Invalid / tampered proof → REJECTED.
    - TEST 9: Primary AI unavailable → fallback model activated → identical security decision.
    - TEST 10: Hindi / Hinglish request → normalized to identical security policy.
    - TEST 11: Unknown recipient → ESCALATE.
    - TEST 12: Over-limit payment (> ₹5,000 standard limit without 2FA) → ESCALATE.
- **Reviewer**: Lead Software Engineer
- **Status**: Passed (12/12 tests passing, total 97 tests passing across 15 suites).

### Phase 16: Demo Polish, Frontend UI & Comprehensive Documentation
- **Components Generated**:
  - `client/src/App.jsx`: Full-stack React 19 interface integrating all 6 core sub-systems.
  - `client/src/components/Header.jsx`: SafePay AI branding, live status, Ramesh Kumar balance chip, language dropdown (EN/HI/TA/Hinglish), Elder Mode toggle, and emergency halt.
  - `client/src/components/QuickDemoBar.jsx`: 1-Click execution bar for the 5 live demo scenarios (Section 38).
  - `client/src/components/AssistantTab.jsx`: Conversational assistant with Web Speech API integration, sample document selector, and live ActionCard decision evaluator.
  - `client/src/components/ActionCard.jsx`: Deterministic decision card displaying ALLOW/REFUSE/ESCALATE badges, risk score, 5 security checks breakdown, HMAC token preview, and isolated payment execution trigger.
  - `client/src/components/TwoFactorModal.jsx`: High-value step-up OTP authentication dialog with strict anti-bypass guard.
  - `client/src/components/AttackSuiteTab.jsx`: Adversarial security suite executing all 22 attack vectors across 6 categories with live normalizer and telemetry inspector.
  - `client/src/components/AuditLogTab.jsx`: Visual blockchain-style SHA-256 hash chain viewer, live integrity verifier, and interactive database tampering simulator.
  - `client/src/components/PrivacyProofTab.jsx`: Zero-knowledge balance range predicate generator and independent third-party verifier.
  - `client/src/components/RecoveryTab.jsx`: 2-of-3 social and emergency key recovery test harness.
  - `client/src/components/TelemetryTab.jsx`: Real measured system telemetry vs SLA target benchmarks table.
  - `README.md`: Comprehensive product and technical documentation, trust model, architecture diagram, 22-vector attack matrix, live demo script, and honest Section 43 weakness disclosure.
- **Reviewer**: Lead Software Engineer
- **Status**: Complete & Verified (All 15 test suites and 97 tests passing; client build successful).

---

## 4. Known AI-Generated Limitations & Accepted Weaknesses

1. **Perceptual Discrepancy**:
   Adversarially crafted documents with zero-width invisible text, font-size micro-formatting, or homoglyphic Unicode can mislead the LLM into generating an erroneous or ungrounded proposal.
   - *Mitigation*: The deterministic grounding validator verifies every financial quantity against strict, trusted records. If any mismatch occurs, the transaction is immediately `ESCALATE`d or `REFUSE`d.
2. **Provider Availability**:
   External hosted LLM APIs may suffer from network latency or downtime.
   - *Mitigation*: Fallback router ensures uninterrupted operation through secondary providers or offline deterministic extractors.
3. **No Direct Authority**:
   The LLM cannot self-authorize actions under any circumstances.
