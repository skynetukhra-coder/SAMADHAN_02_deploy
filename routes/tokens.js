const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. GET ALL TOKENS (from details table)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT TOKEN_NO AS token_number, PSA_NAME AS psa_name FROM details 
       WHERE REPRESENTATIVE_NAME IS NOT NULL 
         AND (SERVICE_PENSION = 'Completed' OR SERVICE_ACCOUNTS = 'Completed' OR SERVICE_GPF = 'Completed')
         AND TOKEN_NO NOT IN (SELECT DISTINCT token_number FROM feedback)
       ORDER BY TOKEN_NO ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tokens:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 1.5 GET PREVIOUS TOKENS BY PSA NAME
router.get('/by-psa', async (req, res) => {
  const { psa_name } = req.query;
  if (!psa_name) {
    return res.status(400).json({ error: 'PSA Name is required' });
  }
  try {
    const [rows] = await db.query(
      `SELECT 
         TOKEN_NO AS token_number, 
         REPRESENTATIVE_NAME AS rep_name, 
         MOBILE AS mobile,
         SERVICE_PENSION AS service_pension,
         SERVICE_ACCOUNTS AS service_accounts,
         SERVICE_GPF AS service_gpf,
         STATUS AS status
       FROM details 
       WHERE PSA_NAME = ? AND REPRESENTATIVE_NAME IS NOT NULL`,
      [psa_name]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tokens by PSA name:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. GET ACTIVE/ALLOCATABLE TOKENS (Pending status from details table, filtered by group_name)
router.get('/active-list', async (req, res) => {
  const { group_name } = req.query;
  const normalizedGroup = (group_name || '').trim().toUpperCase();

  try {
    let query = '';

    if (normalizedGroup.includes('PENSION') || normalizedGroup.includes('ADMINISTRATION')) {
      query = `SELECT TOKEN_NO AS token_number, 'Pension' AS category, PSA_NAME AS psa_name FROM details WHERE SERVICE_PENSION IS NOT NULL AND SERVICE_PENSION != 'Resolved' AND TABLE_PENSION IS NULL`;
    } else if (normalizedGroup.includes('ACCOUNTS')) {
      query = `SELECT TOKEN_NO AS token_number, 'Accounts' AS category, PSA_NAME AS psa_name FROM details WHERE SERVICE_ACCOUNTS IS NOT NULL AND SERVICE_ACCOUNTS != 'Resolved' AND TABLE_ACCOUNTS IS NULL`;
    } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
      query = `SELECT TOKEN_NO AS token_number, 'GPF' AS category, PSA_NAME AS psa_name FROM details WHERE SERVICE_GPF IS NOT NULL AND SERVICE_GPF != 'Resolved' AND TABLE_GPF IS NULL`;
    } else {
      // Fallback/all if no specific group_name is passed or recognized
      query = `
        SELECT TOKEN_NO AS token_number, 'Pension' AS category, PSA_NAME AS psa_name FROM details WHERE SERVICE_PENSION IS NOT NULL AND SERVICE_PENSION != 'Resolved' AND TABLE_PENSION IS NULL
        UNION ALL
        SELECT TOKEN_NO AS token_number, 'Accounts' AS category, PSA_NAME AS psa_name FROM details WHERE SERVICE_ACCOUNTS IS NOT NULL AND SERVICE_ACCOUNTS != 'Resolved' AND TABLE_ACCOUNTS IS NULL
        UNION ALL
        SELECT TOKEN_NO AS token_number, 'GPF' AS category, PSA_NAME AS psa_name FROM details WHERE SERVICE_GPF IS NOT NULL AND SERVICE_GPF != 'Resolved' AND TABLE_GPF IS NULL
      `;
    }

    const [rows] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching active tokens:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. ALLOCATE TABLE
router.post('/allocate', async (req, res) => {
  const { token_number, category, allocated_table, remarks, bo_name } = req.body;

  if (!token_number || !allocated_table || !category) {
    return res.status(400).json({ error: 'Token number, category, and table allocation are required' });
  }

  try {
    let query = '';
    let params = [];

    const normalizedCat = category.toLowerCase();
    if (normalizedCat === 'pension') {
      query = "UPDATE details SET TABLE_PENSION = ?, REMARKS_PENSION = ?, SERVICE_PENSION = 'In Progress', STATUS = 'In Progress', BO_PENSION = ?, ALLOCATED_AT_PENSION = NOW() WHERE TOKEN_NO = ?";
      params = [allocated_table, remarks || '', bo_name || 'System BO', token_number];
    } else if (normalizedCat === 'accounts') {
      query = "UPDATE details SET TABLE_ACCOUNTS = ?, REMARKS_ACCOUNTS = ?, SERVICE_ACCOUNTS = 'In Progress', STATUS = 'In Progress', BO_ACCOUNTS = ?, ALLOCATED_AT_ACCOUNTS = NOW() WHERE TOKEN_NO = ?";
      params = [allocated_table, remarks || '', bo_name || 'System BO', token_number];
    } else if (normalizedCat === 'gpf') {
      query = "UPDATE details SET TABLE_GPF = ?, REMARKS_GPF = ?, SERVICE_GPF = 'In Progress', STATUS = 'In Progress', BO_GPF = ?, ALLOCATED_AT_GPF = NOW() WHERE TOKEN_NO = ?";
      params = [allocated_table, remarks || '', bo_name || 'System BO', token_number];
    } else {
      return res.status(400).json({ error: 'Invalid service category' });
    }

    await db.query(query, params);

    // Sync to tokens table for backwards compatibility
    try {
      const [tokenCheck] = await db.query('SELECT * FROM tokens WHERE token_number = ?', [token_number]);
      if (tokenCheck.length === 0) {
        await db.query(
          `INSERT INTO tokens (token_number, category, status, allocated_table, remarks, submitted_on) 
           VALUES (?, ?, 'In Progress', ?, ?, NOW())`,
          [token_number, category, allocated_table, remarks || '']
        );
      } else {
        await db.query(
          "UPDATE tokens SET allocated_table = ?, remarks = ?, status = 'In Progress' WHERE token_number = ?",
          [allocated_table, remarks || '', token_number]
        );
      }
    } catch (e) {
      // Ignore
    }

    res.json({ message: `Successfully allocated ${allocated_table} to Token ${token_number} (${category})` });
  } catch (err) {
    console.error('Allocation error:', err);
    res.status(500).json({ error: 'Failed to allocate table due to server error' });
  }
});

// 3.5 GET ALL IN-PROGRESS TOKENS FOR LIVE DISPLAY BOARD
router.get('/in-progress', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        TOKEN_NO AS token_number,
        PSA_NAME AS psa_name,
        PSA_CODE AS psa_code,
        SERVICE_PENSION,
        SERVICE_ACCOUNTS,
        SERVICE_GPF,
        TABLE_PENSION,
        TABLE_ACCOUNTS,
        TABLE_GPF
      FROM details
      WHERE REPRESENTATIVE_NAME IS NOT NULL 
        AND (
          SERVICE_PENSION IN ('Pending', 'In Progress') OR 
          SERVICE_ACCOUNTS IN ('Pending', 'In Progress') OR 
          SERVICE_GPF IN ('Pending', 'In Progress')
        )
      ORDER BY TOKEN_NO ASC
    `);

    const formattedRows = rows.map(row => {
      const departments = [];
      const tables = [];

      if (row.SERVICE_PENSION === 'Pending' || row.SERVICE_PENSION === 'In Progress') {
        departments.push('Pension');
        tables.push(row.TABLE_PENSION || 'Not Assigned');
      }
      if (row.SERVICE_ACCOUNTS === 'Pending' || row.SERVICE_ACCOUNTS === 'In Progress') {
        departments.push('Accounts');
        tables.push(row.TABLE_ACCOUNTS || 'Not Assigned');
      }
      if (row.SERVICE_GPF === 'Pending' || row.SERVICE_GPF === 'In Progress') {
        departments.push('GPF');
        tables.push(row.TABLE_GPF || 'Not Assigned');
      }

      // If all active tables are "Not Assigned", show it once instead of "Not Assigned, Not Assigned"
      const uniqueTables = [...new Set(tables)];
      const tableStr = (uniqueTables.length === 1 && uniqueTables[0] === 'Not Assigned')
        ? 'Not Assigned'
        : tables.join(', ');

      return {
        token_number: row.token_number,
        psa_name: row.psa_name,
        psa_code: row.psa_code,
        department: departments.join(', '),
        table_no: tableStr
      };
    });

    res.json(formattedRows);
  } catch (err) {
    console.error('Error fetching in-progress tokens:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3.6 GET ALL TOKENS WITH AUDIT DETAILS FOR ADMIN DASHBOARD
router.get('/admin-list', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        TOKEN_NO AS token_number,
        PSA_NAME AS psa_name,
        PSA_CODE AS psa_code,
        ADDRESS AS address,
        REPRESENTATIVE_NAME AS rep_name,
        MOBILE AS mobile,
        EMAIL AS email,
        SERVICE_PENSION,
        SERVICE_ACCOUNTS,
        SERVICE_GPF,
        TABLE_PENSION,
        TABLE_ACCOUNTS,
        TABLE_GPF,
        REMARKS_PENSION,
        REMARKS_ACCOUNTS,
        REMARKS_GPF,
        STATUS AS status,
        CREATED_AT,
        BO_PENSION,
        ALLOCATED_AT_PENSION,
        BO_ACCOUNTS,
        ALLOCATED_AT_ACCOUNTS,
        BO_GPF,
        ALLOCATED_AT_GPF,
        AAO_PENSION,
        COMPLETED_AT_PENSION,
        AAO_ACCOUNTS,
        COMPLETED_AT_ACCOUNTS,
        AAO_GPF,
        COMPLETED_AT_GPF
      FROM details
      ORDER BY CREATED_AT DESC, TOKEN_NO DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching admin list:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3.8 GET ALL ASSIGNED TOKENS FOR BO DASHBOARD REALTIME TRACKING
router.get('/assigned-list', async (req, res) => {
  const { group_name } = req.query;
  const normalizedGroup = (group_name || '').toUpperCase();

  try {
    let query = '';
    let params = [];

    if (normalizedGroup.includes('PENSION') || normalizedGroup.includes('ADMINISTRATION')) {
      query = `
        SELECT 
          TOKEN_NO AS token_number,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          TABLE_PENSION AS table_no,
          SERVICE_PENSION AS status,
          BO_PENSION AS bo_name,
          ALLOCATED_AT_PENSION AS allocated_at,
          AAO_PENSION AS aao_name,
          REMARKS_PENSION AS remarks,
          COMPLETED_AT_PENSION AS completed_at
        FROM details
        WHERE TABLE_PENSION IS NOT NULL
        ORDER BY ALLOCATED_AT_PENSION DESC
      `;
    } else if (normalizedGroup.includes('ACCOUNTS')) {
      query = `
        SELECT 
          TOKEN_NO AS token_number,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          TABLE_ACCOUNTS AS table_no,
          SERVICE_ACCOUNTS AS status,
          BO_ACCOUNTS AS bo_name,
          ALLOCATED_AT_ACCOUNTS AS allocated_at,
          AAO_ACCOUNTS AS aao_name,
          REMARKS_ACCOUNTS AS remarks,
          COMPLETED_AT_ACCOUNTS AS completed_at
        FROM details
        WHERE TABLE_ACCOUNTS IS NOT NULL
        ORDER BY ALLOCATED_AT_ACCOUNTS DESC
      `;
    } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
      query = `
        SELECT 
          TOKEN_NO AS token_number,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          TABLE_GPF AS table_no,
          SERVICE_GPF AS status,
          BO_GPF AS bo_name,
          ALLOCATED_AT_GPF AS allocated_at,
          AAO_GPF AS aao_name,
          REMARKS_GPF AS remarks,
          COMPLETED_AT_GPF AS completed_at
        FROM details
        WHERE TABLE_GPF IS NOT NULL
        ORDER BY ALLOCATED_AT_GPF DESC
      `;
    } else {
      // Default fallback
      query = `
        SELECT TOKEN_NO AS token_number, PSA_NAME AS psa_name, PSA_CODE AS psa_code, TABLE_PENSION AS table_no, SERVICE_PENSION AS status, BO_PENSION AS bo_name, ALLOCATED_AT_PENSION AS allocated_at, AAO_PENSION AS aao_name, REMARKS_PENSION AS remarks, COMPLETED_AT_PENSION AS completed_at FROM details WHERE TABLE_PENSION IS NOT NULL
        UNION ALL
        SELECT TOKEN_NO AS token_number, PSA_NAME AS psa_name, PSA_CODE AS psa_code, TABLE_ACCOUNTS AS table_no, SERVICE_ACCOUNTS AS status, BO_ACCOUNTS AS bo_name, ALLOCATED_AT_ACCOUNTS AS allocated_at, AAO_ACCOUNTS AS aao_name, REMARKS_ACCOUNTS AS remarks, COMPLETED_AT_ACCOUNTS AS completed_at FROM details WHERE TABLE_ACCOUNTS IS NOT NULL
        UNION ALL
        SELECT TOKEN_NO AS token_number, PSA_NAME AS psa_name, PSA_CODE AS psa_code, TABLE_GPF AS table_no, SERVICE_GPF AS status, BO_GPF AS bo_name, ALLOCATED_AT_GPF AS allocated_at, AAO_GPF AS aao_name, REMARKS_GPF AS remarks, COMPLETED_AT_GPF AS completed_at FROM details WHERE TABLE_GPF IS NOT NULL
      `;
    }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching assigned tokens:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. GET AUTO-FETCHED DETAILS FOR FEEDBACK FORM
router.get('/:tokenNumber/details', async (req, res) => {
  const { tokenNumber } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM details WHERE TOKEN_NO = ?', [tokenNumber]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const row = rows[0];
    let category = 'Pension';
    if (row.SERVICE_ACCOUNTS) category = 'Accounts';
    else if (row.SERVICE_GPF) category = 'GPF';

    res.json({
      psa_ddo: row.PSA_NAME,
      psa_ddo_code: row.PSA_CODE,
      rep_name: row.REPRESENTATIVE_NAME || '',
      mobile: row.MOBILE || '',
      email: row.EMAIL || '',
      address: row.ADDRESS || '',
      category: category,
      hasPension: row.SERVICE_PENSION === 'Completed',
      hasAccounts: row.SERVICE_ACCOUNTS === 'Completed',
      hasGpf: row.SERVICE_GPF === 'Completed'
    });
  } catch (err) {
    console.error('Error fetching token details:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 5. GET TOKENS BY TABLE NUMBER
router.get('/table/:tableNumber', async (req, res) => {
  const { tableNumber } = req.params;
  const { group_name } = req.query;

  try {
    let query = '';
    let params = [];

    const normalizedGroup = (group_name || '').toUpperCase();

    if (normalizedGroup === 'PENSION' || normalizedGroup === 'ADMINISTRATION') {
      query = `
        SELECT 
          TOKEN_NO AS token_number,
          'Pension' AS category,
          SERVICE_PENSION AS status,
          TABLE_PENSION AS allocated_table,
          REMARKS_PENSION AS remarks,
          PSA_NAME AS psa_name
        FROM details 
        WHERE TABLE_PENSION = ? AND SERVICE_PENSION IS NOT NULL
      `;
      params = [tableNumber];
    } else if (normalizedGroup === 'ACCOUNTS') {
      query = `
        SELECT 
          TOKEN_NO AS token_number,
          'Accounts' AS category,
          SERVICE_ACCOUNTS AS status,
          TABLE_ACCOUNTS AS allocated_table,
          REMARKS_ACCOUNTS AS remarks,
          PSA_NAME AS psa_name
        FROM details 
        WHERE TABLE_ACCOUNTS = ? AND SERVICE_ACCOUNTS IS NOT NULL
      `;
      params = [tableNumber];
    } else if (normalizedGroup === 'FUND') {
      query = `
        SELECT 
          TOKEN_NO AS token_number,
          'GPF' AS category,
          SERVICE_GPF AS status,
          TABLE_GPF AS allocated_table,
          REMARKS_GPF AS remarks,
          PSA_NAME AS psa_name
        FROM details 
        WHERE TABLE_GPF = ? AND SERVICE_GPF IS NOT NULL
      `;
      params = [tableNumber];
    } else {
      // Default fallback
      query = `
        SELECT TOKEN_NO AS token_number, 'Pension' AS category, SERVICE_PENSION AS status, TABLE_PENSION AS allocated_table, REMARKS_PENSION AS remarks FROM details WHERE TABLE_PENSION = ?
        UNION ALL
        SELECT TOKEN_NO AS token_number, 'Accounts' AS category, SERVICE_ACCOUNTS AS status, TABLE_ACCOUNTS AS allocated_table, REMARKS_ACCOUNTS AS remarks FROM details WHERE TABLE_ACCOUNTS = ?
        UNION ALL
        SELECT TOKEN_NO AS token_number, 'GPF' AS category, SERVICE_GPF AS status, TABLE_GPF AS allocated_table, REMARKS_GPF AS remarks FROM details WHERE TABLE_GPF = ?
      `;
      params = [tableNumber, tableNumber, tableNumber];
    }

    const [rows] = await db.query(query, params);
    
    // Add dummy submitted_on so the sorting doesn't break
    const processedRows = rows.map(r => ({
      ...r,
      submitted_on: new Date().toISOString()
    }));

    res.json(processedRows);
  } catch (err) {
    console.error('Error fetching table tokens:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 6. UPDATE TOKEN STATUS AND REMARKS
router.post('/update-status', async (req, res) => {
  const { token_number, status, remarks, group_name, aao_name } = req.body;

  if (!token_number || !status) {
    return res.status(400).json({ error: 'Token number and status are required' });
  }

  try {
    const normalizedGroup = (group_name || '').toUpperCase();
    let query = '';
    let params = [];
    const isCompleted = (status === 'Resolved' || status === 'Completed');

    if (normalizedGroup === 'PENSION' || normalizedGroup === 'ADMINISTRATION') {
      query = `
        UPDATE details 
        SET SERVICE_PENSION = ?, REMARKS_PENSION = ?, AAO_PENSION = ?
            ${isCompleted ? ', COMPLETED_AT_PENSION = NOW()' : ''}
        WHERE TOKEN_NO = ?
      `;
      params = [status, remarks || '', aao_name || 'System AAO', token_number];
    } else if (normalizedGroup === 'ACCOUNTS') {
      query = `
        UPDATE details 
        SET SERVICE_ACCOUNTS = ?, REMARKS_ACCOUNTS = ?, AAO_ACCOUNTS = ?
            ${isCompleted ? ', COMPLETED_AT_ACCOUNTS = NOW()' : ''}
        WHERE TOKEN_NO = ?
      `;
      params = [status, remarks || '', aao_name || 'System AAO', token_number];
    } else if (normalizedGroup === 'FUND') {
      query = `
        UPDATE details 
        SET SERVICE_GPF = ?, REMARKS_GPF = ?, AAO_GPF = ?
            ${isCompleted ? ', COMPLETED_AT_GPF = NOW()' : ''}
        WHERE TOKEN_NO = ?
      `;
      params = [status, remarks || '', aao_name || 'System AAO', token_number];
    } else {
      query = 'UPDATE tokens SET status = ?, remarks = ? WHERE token_number = ?';
      params = [status, remarks || '', token_number];
    }

    await db.query(query, params);
    
    try {
      await db.query('UPDATE tokens SET status = ?, remarks = ? WHERE token_number = ?', [status, remarks || '', token_number]);
    } catch (e) {
      // Ignore
    }

    res.json({ message: `Successfully updated Token ${token_number} status to ${status}` });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update token status due to server error' });
  }
});

module.exports = router;

