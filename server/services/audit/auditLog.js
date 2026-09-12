const crypto = require('crypto');

/**
 * Tamper-Evident Audit Log Service (FS-2605 Requirement 15)
 * 
 * Implements a SHA-256 hash chain:
 * current_hash = SHA256(previous_hash + canonicalized_event_data)
 * 
 * Note: Provides tamper-evidence and chain verification.
 * Does not claim blockchain-level consensus or immutability.
 */

/**
 * Canonicalizes event data into a strictly deterministic JSON string
 * Keys are sorted alphabetically to prevent serialization ambiguity.
 */
function canonicalizeEventData(data) {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return '[' + data.map(canonicalizeEventData).join(',') + ']';
  }

  const sortedKeys = Object.keys(data).sort();
  const pairs = sortedKeys.map(key => {
    return `${JSON.stringify(key)}:${canonicalizeEventData(data[key])}`;
  });

  return '{' + pairs.join(',') + '}';
}

/**
 * Calculates SHA-256 hash for a chain block
 */
function calculateBlockHash(previousHash, canonicalData) {
  return crypto
    .createHash('sha256')
    .update(previousHash + canonicalData)
    .digest('hex');
}

/**
 * Appends a new event to the audit hash chain
 * @param {string} eventType 
 * @param {object} eventData 
 * @param {object} db 
 */
async function appendAuditEvent(eventType, eventData, db) {
  const eventId = `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const canonicalData = canonicalizeEventData(eventData);

  // Get the most recent audit entry to link previous_hash
  const latestRes = await db.query('SELECT current_hash FROM audit_logs ORDER BY id DESC LIMIT 1');
  const previousHash = latestRes.rows.length > 0 
    ? latestRes.rows[0].current_hash 
    : '0000000000000000000000000000000000000000000000000000000000000000';

  const currentHash = calculateBlockHash(previousHash, canonicalData);

  const insertRes = await db.query(`
    INSERT INTO audit_logs (
      event_id, event_type, event_data, previous_hash, current_hash, timestamp
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *
  `, [eventId, eventType, canonicalData, previousHash, currentHash]);

  return insertRes.rows[0];
}

/**
 * Verifies the entire audit log hash chain for tampering or broken links
 * @param {object} db 
 */
async function verifyAuditChain(db) {
  const logsRes = await db.query('SELECT * FROM audit_logs ORDER BY id ASC');
  const logs = logsRes.rows;

  if (logs.length === 0) {
    return {
      valid: true,
      chainLength: 0,
      message: 'Audit log is empty (genesis pending).',
    };
  }

  // 1. Verify genesis block
  const genesis = logs[0];
  if (genesis.previous_hash !== '0000000000000000000000000000000000000000000000000000000000000000') {
    return {
      valid: false,
      brokenAtIndex: 0,
      eventId: genesis.event_id,
      errorType: 'INVALID_GENESIS',
      details: 'Genesis previous_hash does not match the zero root hash.',
    };
  }

  // 2. Verify subsequent chain links and data hashes
  for (let i = 0; i < logs.length; i++) {
    const current = logs[i];

    // Verify current block hash calculation
    const recomputedHash = calculateBlockHash(current.previous_hash, current.event_data);
    if (recomputedHash !== current.current_hash) {
      return {
        valid: false,
        brokenAtIndex: i,
        eventId: current.event_id,
        eventType: current.event_type,
        errorType: 'MODIFIED_EVENT_DATA',
        details: `Event at index ${i} ('${current.event_id}') has been modified. Stored hash does not match recomputed data hash.`,
        storedHash: current.current_hash,
        recomputedHash,
      };
    }

    // Verify hash chain linkage with previous block
    if (i > 0) {
      const previous = logs[i - 1];
      if (current.previous_hash !== previous.current_hash) {
        return {
          valid: false,
          brokenAtIndex: i,
          eventId: current.event_id,
          eventType: current.event_type,
          errorType: 'BROKEN_HASH_CHAIN',
          details: `Hash chain broken between index ${i - 1} and ${i}. Previous hash does not match previous block current hash.`,
          expectedPreviousHash: previous.current_hash,
          actualPreviousHash: current.previous_hash,
        };
      }
    }
  }

  return {
    valid: true,
    chainLength: logs.length,
    rootHash: logs[0].current_hash,
    latestHash: logs[logs.length - 1].current_hash,
    message: `Audit chain verified successfully across ${logs.length} tamper-evident blocks.`,
  };
}

module.exports = {
  canonicalizeEventData,
  calculateBlockHash,
  appendAuditEvent,
  verifyAuditChain,
};
