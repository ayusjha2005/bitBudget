/**
 * Authorization Engine (FS-2605 Requirement)
 * Verifies user and account authorization state.
 */

async function verifyAuthorization(userId, db) {
  if (!userId) {
    return {
      authorized: false,
      reason: 'No authenticated user identifier provided.',
    };
  }

  // 1. Fetch user record
  const userRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) {
    return {
      authorized: false,
      reason: `User '${userId}' not found in authorization records.`,
    };
  }

  const user = userRes.rows[0];
  if (user.status !== 'ACTIVE') {
    return {
      authorized: false,
      user,
      reason: `User account is not active (current status: ${user.status}).`,
    };
  }

  // 2. Fetch primary account
  const accRes = await db.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
  if (accRes.rows.length === 0) {
    return {
      authorized: false,
      user,
      reason: `No financial account linked to user '${userId}'.`,
    };
  }

  const account = accRes.rows[0];
  if (account.status !== 'ACTIVE') {
    return {
      authorized: false,
      user,
      account,
      reason: `Financial account is locked or suspended (status: ${account.status}).`,
    };
  }

  return {
    authorized: true,
    user,
    account,
    reason: `User '${user.name}' is authorized with active account '${account.account_number}'.`,
  };
}

module.exports = {
  verifyAuthorization,
};
