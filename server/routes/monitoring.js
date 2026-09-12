const express = require('express');
const router = express.Router();
const { metricsTracker } = require('../services/monitoring/metrics');
const { generatePredicateProof, verifyPredicateProof } = require('../services/proof/predicateProof');

/**
 * GET /metrics
 * Returns real measured system telemetry (FS-2605 Requirement 28)
 */
router.get('/', (req, res) => {
  res.status(200).json(metricsTracker.getMetrics());
});

/**
 * POST /metrics/benchmark
 * Runs 10 iterations of privacy proof generation and verification to benchmark
 * against FS-2605 Section 29 targets:
 * - proof generation: < 3 seconds
 * - proof verification: < 200 ms
 */
router.post('/benchmark', (req, res) => {
  const genTimes = [];
  const verifyTimes = [];

  for (let i = 0; i < 10; i++) {
    const startGen = Date.now();
    const proofPackage = generatePredicateProof(82450.00, 50000, 'INR');
    const genDuration = Date.now() - startGen;
    genTimes.push(genDuration);
    metricsTracker.recordProofGenerationTime(genDuration);

    const startVerify = Date.now();
    verifyPredicateProof(proofPackage.publicInputs, proofPackage.proof);
    const verifyDuration = Date.now() - startVerify;
    verifyTimes.push(verifyDuration);
    metricsTracker.recordProofVerificationTime(verifyDuration);
  }

  const currentMetrics = metricsTracker.getMetrics();

  res.status(200).json({
    message: 'Benchmark completed (10 sample iterations)',
    measuredTimes: {
      generationSamplesMs: genTimes,
      verificationSamplesMs: verifyTimes,
    },
    targets: {
      targetProofGeneration: '< 3000 ms',
      targetProofVerification: '< 200 ms',
      targetEndToEndP95: '< 4000 ms',
    },
    metricsSummary: currentMetrics,
  });
});

module.exports = router;
