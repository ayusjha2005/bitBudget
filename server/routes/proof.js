const express = require('express');
const router = express.Router();
const { generatePredicateProof, verifyPredicateProof } = require('../services/proof/predicateProof');
const { appendAuditEvent } = require('../services/audit/auditLog');
const { getDb } = require('../db/client');

/**
 * POST /proof/generate
 * Generates a privacy-preserving predicate proof for user's balance
 * Example: Proves balance >= 50,000 without disclosing actual balance (₹82,450).
 */
router.post('/generate', async (req, res, next) => {
  try {
    const db = await getDb();
    const { userId = 'USR_RAMESH_001', threshold = 50000, currency = 'INR' } = req.body;

    // Securely retrieve account balance on server
    const accRes = await db.query('SELECT balance, currency FROM accounts WHERE user_id = $1', [userId]);
    if (accRes.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const actualBalance = parseFloat(accRes.rows[0].balance);
    const proofPackage = generatePredicateProof(actualBalance, threshold, currency);

    // Save proof record in database
    await db.query(`
      INSERT INTO proofs (
        id, user_id, proof_type, predicate, public_inputs, proof_data, verified
      ) VALUES ($1, $2, 'PREDICATE_BALANCE_GE', $3, $4, $5, TRUE)
    `, [
      proofPackage.proofId,
      userId,
      proofPackage.predicate,
      JSON.stringify(proofPackage.publicInputs),
      JSON.stringify(proofPackage.proof),
    ]);

    // Audit log proof generation (without logging actual balance)
    await appendAuditEvent('PRIVACY_PROOF_GENERATED', {
      proofId: proofPackage.proofId,
      userId,
      predicate: proofPackage.predicate,
      threshold,
      commitment: proofPackage.publicInputs.commitment,
    }, db);

    res.status(200).json({
      success: true,
      proofId: proofPackage.proofId,
      predicate: proofPackage.predicate,
      publicInputs: proofPackage.publicInputs,
      proof: proofPackage.proof,
      actualBalanceExposed: false,
      generationTimeMs: proofPackage.generationTimeMs,
      statement: `Cryptographic proof generated for: ${proofPackage.predicate}. Actual balance is not revealed.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /proof/verify
 * Verifies a predicate proof using only public inputs and proof data.
 * Verifier NEVER sees or receives the actual balance.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const db = await getDb();
    const { publicInputs, proof } = req.body;

    const result = verifyPredicateProof(publicInputs, proof);

    // Audit log verification outcome
    await appendAuditEvent('PRIVACY_PROOF_VERIFIED', {
      verified: result.verified,
      predicate: result.predicate,
      threshold: publicInputs?.threshold,
    }, db);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
