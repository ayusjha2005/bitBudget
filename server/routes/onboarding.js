const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../db/client');
const { ensureUUID } = require('../services/db/compat');

/**
 * POST /assistant/onboard
 * Creates or resets the active user and primary banking account in Supabase
 */
router.post('/onboard', async (req, res, next) => {
  try {
    const db = await getDb();
    const {
      name = 'Ayush',
      balance = 50000.00,
      phone = '+91 98765 43210',
      language = 'en',
      elderMode = false,
      voiceEnabled = true,
    } = req.body;

    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const accountRef = `ACC-${Date.now().toString().slice(-6)}`;
    let effectiveUserId = userId;

    // Check if table users has column 'risk_policy' (Supabase schema)
    const colCheck = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'risk_policy' LIMIT 1"
    );

    if (colCheck.rows && colCheck.rows.length > 0) {
      // Supabase Schema: check if user already exists
      const existingUser = await db.query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [phone]);
      if (existingUser.rows.length > 0) {
        effectiveUserId = existingUser.rows[0].id;
        await db.query(`
          UPDATE users 
          SET name = $1, language = $2, elder_mode = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [name, language, elderMode, effectiveUserId]);
      } else {
        await db.query(`
          INSERT INTO users (
            id, name, phone, language, elder_mode, voice_enabled, risk_policy, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          userId,
          name,
          phone,
          language,
          elderMode,
          voiceEnabled,
          JSON.stringify({ maxPerTransaction: 50000, highRiskThreshold: 10000, requireTwoFactorAbove: 15000 }),
        ]);
      }

      // Check if account already exists for user
      const existingAcc = await db.query('SELECT id FROM accounts WHERE user_id = $1 LIMIT 1', [effectiveUserId]);
      if (existingAcc.rows.length > 0) {
        await db.query(`
          UPDATE accounts 
          SET balance = $1, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [parseFloat(balance), existingAcc.rows[0].id]);
      } else {
        await db.query(`
          INSERT INTO accounts (
            id, user_id, account_reference, currency, balance, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          accountId,
          effectiveUserId,
          accountRef,
          'INR',
          parseFloat(balance),
          'ACTIVE',
        ]);
      }

      // Add standard utility recipients if recipients table is empty
      const recCount = await db.query('SELECT count(*) FROM recipients');
      if (parseInt(recCount.rows[0].count) === 0) {
        const utilities = [
          { name: 'BESCOM Electricity Bangalore', ref: 'BESCOM-BLR-01', bank: 'SBI', status: 'VERIFIED' },
          { name: 'Airtel Broadband & Mobile', ref: 'AIRTEL-BILL-09', bank: 'HDFC', status: 'VERIFIED' },
          { name: 'Indraprastha Gas Limited', ref: 'IGL-UTILITY-44', bank: 'ICICI', status: 'VERIFIED' },
          { name: 'Suresh Kumar (Son / Trusted)', ref: 'SURESH-UPI-01', bank: 'AXIS', status: 'VERIFIED' },
        ];

        for (const u of utilities) {
          await db.query(`
            INSERT INTO recipients (
              id, user_id, name, account_reference, bank_identifier, status, is_new, verified_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [crypto.randomUUID(), effectiveUserId, u.name, u.ref, u.bank, u.status, false]);
        }
      }
    } else {
      // Standard local schema
      await db.query(`
        INSERT INTO users (id, name, email, phone, preferred_language, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        ON CONFLICT (id) DO NOTHING
      `, [userId, name, `${name.toLowerCase().replace(/\s+/g, '')}@example.com`, phone, language]);

      await db.query(`
        INSERT INTO accounts (id, user_id, account_number, balance, currency, status)
        VALUES ($1, $2, $3, $4, 'INR', 'ACTIVE')
        ON CONFLICT (id) DO NOTHING
      `, [accountId, userId, accountRef, parseFloat(balance)]);
    }

    res.status(200).json({
      success: true,
      user: {
        id: effectiveUserId || userId,
        name,
        phone,
        language,
        elderMode,
      },
      account: {
        id: accountId,
        accountReference: accountRef,
        balance: parseFloat(balance),
        currency: 'INR',
      },
      message: 'Account successfully initialized in Supabase database.',
    });
  } catch (err) {
    console.error('Onboard error:', err);
    next(err);
  }
});

/**
 * GET /assistant/recipients
 * Returns directory of whitelisted payees
 */
router.get('/recipients', async (req, res, next) => {
  try {
    const db = await getDb();
    const colCheck = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'recipients' AND column_name = 'account_reference' LIMIT 1"
    );

    let queryText;
    if (colCheck.rows && colCheck.rows.length > 0) {
      // Supabase schema
      queryText = `
        SELECT id, name, 
               account_reference, 
               COALESCE(bank_identifier, 'UTILITY') as category,
               (status = 'VERIFIED') as is_verified,
               0.00 as risk_score
        FROM recipients
        ORDER BY name ASC
      `;
    } else {
      // Local schema
      queryText = `
        SELECT id, name, 
               account_number as account_reference, 
               COALESCE(category, 'UTILITY') as category,
               COALESCE(is_verified, false) as is_verified,
               COALESCE(risk_score, 0.00) as risk_score
        FROM recipients
        ORDER BY name ASC
      `;
    }

    const result = await db.query(queryText);
    res.status(200).json({
      success: true,
      recipients: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /assistant/recipients
 * Adds a new verified or pending recipient to the directory
 */
router.post('/recipients', async (req, res, next) => {
  try {
    const db = await getDb();
    const { name, accountNumber, bankIdentifier = 'NEFT', isWhitelisted = true } = req.body;

    if (!name || !accountNumber) {
      return res.status(400).json({ error: 'Name and Account Number are required.' });
    }

    // Get current user id
    const userRes = await db.query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0]?.id || null;

    const recId = crypto.randomUUID();

    // Check if Supabase schema
    const colCheck = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'recipients' AND column_name = 'bank_identifier' LIMIT 1"
    );

    if (colCheck.rows && colCheck.rows.length > 0) {
      await db.query(`
        INSERT INTO recipients (
          id, user_id, name, account_reference, bank_identifier, status, is_new, verified_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [recId, userId, name, accountNumber, bankIdentifier, isWhitelisted ? 'VERIFIED' : 'UNVERIFIED', false]);
    } else {
      await db.query(`
        INSERT INTO recipients (
          id, name, account_number, category, is_verified, risk_score
        ) VALUES ($1, $2, $3, $4, $5, 0.00)
      `, [recId, name, accountNumber, 'MERCHANT', isWhitelisted]);
    }

    res.status(200).json({
      success: true,
      recipient: {
        id: recId,
        name,
        accountNumber,
        isVerified: isWhitelisted,
      },
      message: `Recipient '${name}' added successfully.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /assistant/deposit
 * Top-up balance on active account in Supabase
 */
router.post('/deposit', async (req, res, next) => {
  try {
    const db = await getDb();
    const { amount = 5000 } = req.body;
    const addAmt = parseFloat(amount);

    const accRes = await db.query('SELECT id, balance FROM accounts LIMIT 1');
    if (accRes.rows.length === 0) {
      return res.status(400).json({ error: 'No account found. Please onboard first.' });
    }

    const currentBal = parseFloat(accRes.rows[0].balance || 0);
    const newBal = currentBal + addAmt;

    await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBal, accRes.rows[0].id]);

    res.status(200).json({
      success: true,
      balance: newBal,
      deposited: addAmt,
      message: `Successfully deposited ₹${addAmt.toLocaleString('en-IN')}. New balance: ₹${newBal.toLocaleString('en-IN')}`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
