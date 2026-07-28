const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'samadhan_secret_jwt_key_2026_xyz';

// 1. REGISTER
router.post('/register', async (req, res) => {
  const { psa_ddo, psa_ddo_code, address, rep_name, designation, mobile, email, services } = req.body;

  if (!psa_ddo || !rep_name || !mobile || !email) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  try {
    const servicesArr = Array.isArray(services) ? services : [];
    const hasPension = servicesArr.includes('PENSION') ? 'Pending' : null;
    const hasAccounts = servicesArr.includes('ACCOUNTS') ? 'Pending' : null;
    const hasGpf = servicesArr.includes('GPF') ? 'Pending' : null;

    // Generate a brand new sequential unique token number (e.g. TKN001, TKN002...)
    const [maxTokenRow] = await db.query("SELECT TOKEN_NO FROM details WHERE TOKEN_NO LIKE 'TKN%' ORDER BY CAST(SUBSTRING(TOKEN_NO, 4) AS UNSIGNED) DESC LIMIT 1");
    let tokenNo = 'TKN001';
    if (maxTokenRow.length > 0) {
      const lastNum = parseInt(maxTokenRow[0].TOKEN_NO.substring(3), 10);
      tokenNo = 'TKN' + String(lastNum + 1).padStart(3, '0');
    }

    // Insert new token row directly into details table
    await db.query(
      `INSERT INTO details (TOKEN_NO, PSA_NAME, PSA_CODE, ADDRESS, REPRESENTATIVE_NAME, MOBILE, EMAIL, SERVICE_PENSION, SERVICE_ACCOUNTS, SERVICE_GPF, STATUS) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [tokenNo, psa_ddo, psa_ddo_code || null, address || null, rep_name, mobile, email, hasPension, hasAccounts, hasGpf]
    );

    // 4. Also register them in users table for backwards compatibility
    const username = email.split('@')[0].split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
    let group_name = 'ADMINISTRATION';
    if (servicesArr.includes('ACCOUNTS')) {
      group_name = 'ACCOUNTS';
    } else if (servicesArr.includes('GPF')) {
      group_name = 'FUND';
    }

    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing.length === 0) {
      await db.query(
        `INSERT INTO users (username, password, full_name, designation, group_name, email, psa_ddo, psa_ddo_code, address) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, mobile, rep_name, designation || 'Sr. Accounts Officer', group_name, email, psa_ddo || null, psa_ddo_code || null, address || null]
      );
    }

    res.status(201).json({ 
      message: 'User registered successfully',
      token_number: tokenNo
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user. Database error.' });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body; // username or email

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter credentials and password' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const user = users[0];

    const isMatch = (password.trim() === user.password.trim());
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.user_id, name: user.full_name, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password before sending
    delete user.password;

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// 3. GET DDO/PSA LIST
router.get('/ddos', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT PSA_NAME, PSA_CODE, ADDRESS FROM ddo_master ORDER BY PSA_NAME ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching DDOS list:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
