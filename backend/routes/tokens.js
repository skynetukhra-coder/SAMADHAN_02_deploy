const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. GET ALL TOKENS (from details table)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT TOKEN_NO AS token_number, PSA_NAME AS psa_name FROM details 
       WHERE REPRESENTATIVE_NAME IS NOT NULL 
         AND (SERVICE_PENSION IN ('Completed', 'Resolved') 
           OR SERVICE_ACCOUNTS IN ('Completed', 'Resolved') 
           OR SERVICE_GPF IN ('Completed', 'Resolved'))
         AND TOKEN_NO NOT IN (SELECT DISTINCT token_number FROM feedback)
       ORDER BY TOKEN_NO ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tokens:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 1.5 GET PREVIOUS TOKENS AND REPRESENTATIVES BY PSA NAME OR PSA CODE
router.get('/by-psa', async (req, res) => {
  const { psa_name, psa_code } = req.query;
  if (!psa_name && !psa_code) {
    return res.status(400).json({ error: 'PSA Name or PSA Code is required' });
  }
  try {
    let whereClause = '';
    let params = [];
    if (psa_code && psa_name) {
      whereClause = '(PSA_CODE = ? OR PSA_NAME = ?)';
      params = [psa_code.trim(), psa_name.trim()];
    } else if (psa_code) {
      whereClause = 'PSA_CODE = ?';
      params = [psa_code.trim()];
    } else {
      whereClause = 'PSA_NAME = ?';
      params = [psa_name.trim()];
    }

    // 1. Fetch tokens for this PSA
    const [rows] = await db.query(
      `SELECT 
         id AS entry_id,
         TOKEN_NO AS token_number, 
         REPRESENTATIVE_NAME AS rep_name, 
         MOBILE AS mobile, 
         EMAIL AS email, 
         SERVICE_PENSION AS service_pension, 
         SERVICE_ACCOUNTS AS service_accounts, 
         SERVICE_GPF AS service_gpf, 
         STATUS AS status, 
         CREATED_AT AS created_at 
       FROM details 
       WHERE ${whereClause} AND TOKEN_NO IS NOT NULL 
       ORDER BY CAST(REGEXP_SUBSTR(TOKEN_NO, '[0-9]+') AS UNSIGNED) DESC, TOKEN_NO DESC, id DESC`,
      params
    );

    // Group rows by token_number to collect all representative names associated with each token
    const tokenMap = new Map();
    for (const r of rows) {
      if (!tokenMap.has(r.token_number)) {
        tokenMap.set(r.token_number, {
          token_number: r.token_number,
          rep_name: r.rep_name || '',
          rep_names: [],
          mobile: r.mobile || '',
          email: r.email || '',
          service_pension: r.service_pension,
          service_accounts: r.service_accounts,
          service_gpf: r.service_gpf,
          status: r.status,
          created_at: r.created_at,
          entry_count: 0
        });
      }
      const item = tokenMap.get(r.token_number);
      item.entry_count += 1;
      const repTrimmed = (r.rep_name || '').trim();
      if (repTrimmed && !item.rep_names.includes(repTrimmed)) {
        item.rep_names.push(repTrimmed);
      }
    }

    const groupedTokens = Array.from(tokenMap.values()).map(item => ({
      ...item,
      rep_names_str: item.rep_names.length > 0 ? item.rep_names.join(', ') : 'No Name'
    }));

    // 2. Fetch distinct representative names and their details
    const [repRows] = await db.query(
      `SELECT 
         REPRESENTATIVE_NAME AS rep_name, 
         MOBILE AS mobile,
         EMAIL AS email
       FROM details 
       WHERE ${whereClause} AND REPRESENTATIVE_NAME IS NOT NULL AND TRIM(REPRESENTATIVE_NAME) != ''
       ORDER BY id DESC`,
      params
    );

    const repsMap = new Map();
    for (const r of repRows) {
      const trimmed = (r.rep_name || '').trim();
      if (trimmed && !repsMap.has(trimmed.toLowerCase())) {
        repsMap.set(trimmed.toLowerCase(), {
          rep_name: trimmed,
          mobile: r.mobile || '',
          email: r.email || ''
        });
      }
    }
    const representatives = Array.from(repsMap.values());

    // 3. Compute next token number
    const [maxTokenRow] = await db.query(
      "SELECT TOKEN_NO FROM details WHERE TOKEN_NO LIKE 'TKN%' ORDER BY CAST(SUBSTRING(TOKEN_NO, 4) AS UNSIGNED) DESC LIMIT 1"
    );
    let nextTokenNumber = 'TKN001';
    if (maxTokenRow.length > 0) {
      const lastNum = parseInt(maxTokenRow[0].TOKEN_NO.substring(3), 10);
      nextTokenNumber = 'TKN' + String(lastNum + 1).padStart(3, '0');
    }

    res.json({
      tokens: groupedTokens,
      all_entries: rows,
      representatives,
      next_token_number: nextTokenNumber
    });
  } catch (err) {
    console.error('Error fetching tokens by PSA:', err);
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
      query = `
        SELECT 
          TOKEN_NO AS token_number, 
          'Pension' AS category, 
          MAX(PSA_NAME) AS psa_name,
          MAX(PSA_CODE) AS psa_code,
          GROUP_CONCAT(DISTINCT REPRESENTATIVE_NAME SEPARATOR ', ') AS rep_names,
          COUNT(*) AS entry_count
        FROM details 
        WHERE SERVICE_PENSION IS NOT NULL AND SERVICE_PENSION != 'Resolved' AND TABLE_PENSION IS NULL
        GROUP BY TOKEN_NO
        ORDER BY CAST(SUBSTRING(TOKEN_NO, 4) AS UNSIGNED) ASC
      `;
    } else if (normalizedGroup.includes('ACCOUNTS')) {
      query = `
        SELECT 
          TOKEN_NO AS token_number, 
          'Accounts' AS category, 
          MAX(PSA_NAME) AS psa_name,
          MAX(PSA_CODE) AS psa_code,
          GROUP_CONCAT(DISTINCT REPRESENTATIVE_NAME SEPARATOR ', ') AS rep_names,
          COUNT(*) AS entry_count
        FROM details 
        WHERE SERVICE_ACCOUNTS IS NOT NULL AND SERVICE_ACCOUNTS != 'Resolved' AND TABLE_ACCOUNTS IS NULL
        GROUP BY TOKEN_NO
        ORDER BY CAST(SUBSTRING(TOKEN_NO, 4) AS UNSIGNED) ASC
      `;
    } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
      query = `
        SELECT 
          TOKEN_NO AS token_number, 
          'GPF' AS category, 
          MAX(PSA_NAME) AS psa_name,
          MAX(PSA_CODE) AS psa_code,
          GROUP_CONCAT(DISTINCT REPRESENTATIVE_NAME SEPARATOR ', ') AS rep_names,
          COUNT(*) AS entry_count
        FROM details 
        WHERE SERVICE_GPF IS NOT NULL AND SERVICE_GPF != 'Resolved' AND TABLE_GPF IS NULL
        GROUP BY TOKEN_NO
        ORDER BY CAST(SUBSTRING(TOKEN_NO, 4) AS UNSIGNED) ASC
      `;
    } else {
      // Fallback/all if no specific group_name is passed or recognized
      query = `
        SELECT TOKEN_NO AS token_number, 'Pension' AS category, MAX(PSA_NAME) AS psa_name, MAX(PSA_CODE) AS psa_code, GROUP_CONCAT(DISTINCT REPRESENTATIVE_NAME SEPARATOR ', ') AS rep_names, COUNT(*) AS entry_count FROM details WHERE SERVICE_PENSION IS NOT NULL AND SERVICE_PENSION != 'Resolved' AND TABLE_PENSION IS NULL GROUP BY TOKEN_NO
        UNION ALL
        SELECT TOKEN_NO AS token_number, 'Accounts' AS category, MAX(PSA_NAME) AS psa_name, MAX(PSA_CODE) AS psa_code, GROUP_CONCAT(DISTINCT REPRESENTATIVE_NAME SEPARATOR ', ') AS rep_names, COUNT(*) AS entry_count FROM details WHERE SERVICE_ACCOUNTS IS NOT NULL AND SERVICE_ACCOUNTS != 'Resolved' AND TABLE_ACCOUNTS IS NULL GROUP BY TOKEN_NO
        UNION ALL
        SELECT TOKEN_NO AS token_number, 'GPF' AS category, MAX(PSA_NAME) AS psa_name, MAX(PSA_CODE) AS psa_code, GROUP_CONCAT(DISTINCT REPRESENTATIVE_NAME SEPARATOR ', ') AS rep_names, COUNT(*) AS entry_count FROM details WHERE SERVICE_GPF IS NOT NULL AND SERVICE_GPF != 'Resolved' AND TABLE_GPF IS NULL GROUP BY TOKEN_NO
        ORDER BY CAST(SUBSTRING(token_number, 4) AS UNSIGNED) ASC
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
          id AS entry_id,
          TOKEN_NO AS token_number,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          REPRESENTATIVE_NAME AS rep_name,
          MOBILE AS mobile,
          EMAIL AS email,
          SERVICE_PENSION,
          SERVICE_ACCOUNTS,
          SERVICE_GPF,
          TABLE_PENSION AS table_no,
          SERVICE_PENSION AS status,
          BO_PENSION AS bo_name,
          ALLOCATED_AT_PENSION AS allocated_at,
          AAO_PENSION AS aao_name,
          REMARKS_PENSION AS remarks,
          COMPLETED_AT_PENSION AS completed_at,
          CREATED_AT AS submitted_on
        FROM details
        WHERE TABLE_PENSION IS NOT NULL
        ORDER BY ALLOCATED_AT_PENSION DESC, id DESC
      `;
    } else if (normalizedGroup.includes('ACCOUNTS')) {
      query = `
        SELECT 
          id AS entry_id,
          TOKEN_NO AS token_number,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          REPRESENTATIVE_NAME AS rep_name,
          MOBILE AS mobile,
          EMAIL AS email,
          SERVICE_PENSION,
          SERVICE_ACCOUNTS,
          SERVICE_GPF,
          TABLE_ACCOUNTS AS table_no,
          SERVICE_ACCOUNTS AS status,
          BO_ACCOUNTS AS bo_name,
          ALLOCATED_AT_ACCOUNTS AS allocated_at,
          AAO_ACCOUNTS AS aao_name,
          REMARKS_ACCOUNTS AS remarks,
          COMPLETED_AT_ACCOUNTS AS completed_at,
          CREATED_AT AS submitted_on
        FROM details
        WHERE TABLE_ACCOUNTS IS NOT NULL
        ORDER BY ALLOCATED_AT_ACCOUNTS DESC, id DESC
      `;
    } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
      query = `
        SELECT 
          id AS entry_id,
          TOKEN_NO AS token_number,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          REPRESENTATIVE_NAME AS rep_name,
          MOBILE AS mobile,
          EMAIL AS email,
          SERVICE_PENSION,
          SERVICE_ACCOUNTS,
          SERVICE_GPF,
          TABLE_GPF AS table_no,
          SERVICE_GPF AS status,
          BO_GPF AS bo_name,
          ALLOCATED_AT_GPF AS allocated_at,
          AAO_GPF AS aao_name,
          REMARKS_GPF AS remarks,
          COMPLETED_AT_GPF AS completed_at,
          CREATED_AT AS submitted_on
        FROM details
        WHERE TABLE_GPF IS NOT NULL
        ORDER BY ALLOCATED_AT_GPF DESC, id DESC
      `;
    } else {
      // Default fallback
      query = `
        SELECT id AS entry_id, TOKEN_NO AS token_number, PSA_NAME AS psa_name, PSA_CODE AS psa_code, REPRESENTATIVE_NAME AS rep_name, MOBILE AS mobile, EMAIL AS email, SERVICE_PENSION, SERVICE_ACCOUNTS, SERVICE_GPF, TABLE_PENSION AS table_no, SERVICE_PENSION AS status, BO_PENSION AS bo_name, ALLOCATED_AT_PENSION AS allocated_at, AAO_PENSION AS aao_name, REMARKS_PENSION AS remarks, COMPLETED_AT_PENSION AS completed_at, CREATED_AT AS submitted_on FROM details WHERE TABLE_PENSION IS NOT NULL
        UNION ALL
        SELECT id AS entry_id, TOKEN_NO AS token_number, PSA_NAME AS psa_name, PSA_CODE AS psa_code, REPRESENTATIVE_NAME AS rep_name, MOBILE AS mobile, EMAIL AS email, SERVICE_PENSION, SERVICE_ACCOUNTS, SERVICE_GPF, TABLE_ACCOUNTS AS table_no, SERVICE_ACCOUNTS AS status, BO_ACCOUNTS AS bo_name, ALLOCATED_AT_ACCOUNTS AS allocated_at, AAO_ACCOUNTS AS aao_name, REMARKS_ACCOUNTS AS remarks, COMPLETED_AT_ACCOUNTS AS completed_at, CREATED_AT AS submitted_on FROM details WHERE TABLE_ACCOUNTS IS NOT NULL
        UNION ALL
        SELECT id AS entry_id, TOKEN_NO AS token_number, PSA_NAME AS psa_name, PSA_CODE AS psa_code, REPRESENTATIVE_NAME AS rep_name, MOBILE AS mobile, EMAIL AS email, SERVICE_PENSION, SERVICE_ACCOUNTS, SERVICE_GPF, TABLE_GPF AS table_no, SERVICE_GPF AS status, BO_GPF AS bo_name, ALLOCATED_AT_GPF AS allocated_at, AAO_GPF AS aao_name, REMARKS_GPF AS remarks, COMPLETED_AT_GPF AS completed_at, CREATED_AT AS submitted_on FROM details WHERE TABLE_GPF IS NOT NULL
        ORDER BY allocated_at DESC, entry_id DESC
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
      hasPension: ['Completed', 'Resolved'].includes(row.SERVICE_PENSION),
      hasAccounts: ['Completed', 'Resolved'].includes(row.SERVICE_ACCOUNTS),
      hasGpf: ['Completed', 'Resolved'].includes(row.SERVICE_GPF)
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
    const cleanTable = (tableNumber || '').trim();
    const numMatch = cleanTable.match(/\d+/);
    const numStr = numMatch ? numMatch[0] : '';
    const paddedNum = numStr ? String(numStr).padStart(3, '0') : '';

    const tableMatches = [cleanTable, `Table ${numStr}`, `table ${numStr}`, numStr].filter(Boolean);
    const tokenMatches = numStr ? [`TKN${paddedNum}`, `TKN${numStr}`, `TKN0${numStr}`, numStr] : ['__NONE__'];

    if (normalizedGroup === 'PENSION' || normalizedGroup === 'ADMINISTRATION') {
      query = `
        SELECT 
          id AS entry_id,
          TOKEN_NO AS token_number,
          'Pension' AS category,
          SERVICE_PENSION,
          SERVICE_ACCOUNTS,
          SERVICE_GPF,
          SERVICE_PENSION AS status,
          TABLE_PENSION AS allocated_table,
          REMARKS_PENSION AS remarks,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          REPRESENTATIVE_NAME AS rep_name,
          MOBILE AS mobile,
          EMAIL AS email,
          CREATED_AT AS submitted_on
        FROM details 
        WHERE (TABLE_PENSION IN (?) OR (TABLE_PENSION IS NULL AND TOKEN_NO IN (?))) 
          AND SERVICE_PENSION IS NOT NULL
        ORDER BY id ASC
      `;
      params = [tableMatches, tokenMatches];
    } else if (normalizedGroup === 'ACCOUNTS') {
      query = `
        SELECT 
          id AS entry_id,
          TOKEN_NO AS token_number,
          'Accounts' AS category,
          SERVICE_PENSION,
          SERVICE_ACCOUNTS,
          SERVICE_GPF,
          SERVICE_ACCOUNTS AS status,
          TABLE_ACCOUNTS AS allocated_table,
          REMARKS_ACCOUNTS AS remarks,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          REPRESENTATIVE_NAME AS rep_name,
          MOBILE AS mobile,
          EMAIL AS email,
          CREATED_AT AS submitted_on
        FROM details 
        WHERE (TABLE_ACCOUNTS IN (?) OR (TABLE_ACCOUNTS IS NULL AND TOKEN_NO IN (?))) 
          AND SERVICE_ACCOUNTS IS NOT NULL
        ORDER BY id ASC
      `;
      params = [tableMatches, tokenMatches];
    } else if (normalizedGroup === 'FUND') {
      query = `
        SELECT 
          id AS entry_id,
          TOKEN_NO AS token_number,
          'GPF' AS category,
          SERVICE_PENSION,
          SERVICE_ACCOUNTS,
          SERVICE_GPF,
          SERVICE_GPF AS status,
          TABLE_GPF AS allocated_table,
          REMARKS_GPF AS remarks,
          PSA_NAME AS psa_name,
          PSA_CODE AS psa_code,
          REPRESENTATIVE_NAME AS rep_name,
          MOBILE AS mobile,
          EMAIL AS email,
          CREATED_AT AS submitted_on
        FROM details 
        WHERE (TABLE_GPF IN (?) OR (TABLE_GPF IS NULL AND TOKEN_NO IN (?))) 
          AND SERVICE_GPF IS NOT NULL
        ORDER BY id ASC
      `;
      params = [tableMatches, tokenMatches];
    } else {
      // Default fallback: match across any service
      query = `
        SELECT id AS entry_id, TOKEN_NO AS token_number, 'Pension' AS category, SERVICE_PENSION, SERVICE_ACCOUNTS, SERVICE_GPF, SERVICE_PENSION AS status, TABLE_PENSION AS allocated_table, REMARKS_PENSION AS remarks, PSA_NAME AS psa_name, PSA_CODE AS psa_code, REPRESENTATIVE_NAME AS rep_name, MOBILE AS mobile, EMAIL AS email, CREATED_AT AS submitted_on FROM details WHERE (TABLE_PENSION IN (?) OR (TABLE_PENSION IS NULL AND TOKEN_NO IN (?)))
        UNION ALL
        SELECT id AS entry_id, TOKEN_NO AS token_number, 'Accounts' AS category, SERVICE_PENSION, SERVICE_ACCOUNTS, SERVICE_GPF, SERVICE_ACCOUNTS AS status, TABLE_ACCOUNTS AS allocated_table, REMARKS_ACCOUNTS AS remarks, PSA_NAME AS psa_name, PSA_CODE AS psa_code, REPRESENTATIVE_NAME AS rep_name, MOBILE AS mobile, EMAIL AS email, CREATED_AT AS submitted_on FROM details WHERE (TABLE_ACCOUNTS IN (?) OR (TABLE_ACCOUNTS IS NULL AND TOKEN_NO IN (?)))
        UNION ALL
        SELECT id AS entry_id, TOKEN_NO AS token_number, 'GPF' AS category, SERVICE_PENSION, SERVICE_ACCOUNTS, SERVICE_GPF, SERVICE_GPF AS status, TABLE_GPF AS allocated_table, REMARKS_GPF AS remarks, PSA_NAME AS psa_name, PSA_CODE AS psa_code, REPRESENTATIVE_NAME AS rep_name, MOBILE AS mobile, EMAIL AS email, CREATED_AT AS submitted_on FROM details WHERE (TABLE_GPF IN (?) OR (TABLE_GPF IS NULL AND TOKEN_NO IN (?)))
        ORDER BY entry_id ASC
      `;
      params = [tableMatches, tokenMatches, tableMatches, tokenMatches, tableMatches, tokenMatches];
    }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching table tokens:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 5.5 GET ALL ENTRIES FOR A TOKEN NUMBER
router.get('/:tokenNumber/all-entries', async (req, res) => {
  const { tokenNumber } = req.params;
  const cleanTkn = (tokenNumber || '').trim();
  const numMatch = cleanTkn.match(/\d+/);
  const numStr = numMatch ? numMatch[0] : '';
  const paddedNum = numStr ? String(numStr).padStart(3, '0') : '';
  const possibleTokens = [
    cleanTkn,
    `TKN${paddedNum}`,
    `TKN${numStr}`,
    `TKN0${numStr}`,
    numStr
  ].filter(Boolean);

  try {
    const [rows] = await db.query(
      `SELECT 
         id AS entry_id,
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
         COALESCE(NULLIF(REMARKS_PENSION, ''), NULLIF(REMARKS_ACCOUNTS, ''), NULLIF(REMARKS_GPF, ''), '') AS remarks,
         STATUS AS status,
         CREATED_AT AS submitted_on
       FROM details
       WHERE TOKEN_NO IN (?)
       ORDER BY id ASC`,
      [possibleTokens]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching token entries:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 6. UPDATE TOKEN STATUS AND REMARKS (supports specific entry_id)
router.post('/update-status', async (req, res) => {
  const { token_number, entry_id, status, remarks, group_name, aao_name } = req.body;

  if ((!token_number && !entry_id) || !status) {
    return res.status(400).json({ error: 'Token number/entry ID and status are required' });
  }

  try {
    const normalizedGroup = (group_name || '').toUpperCase();
    const isCompleted = (status === 'Resolved' || status === 'Completed');

    if (entry_id) {
      // Fetch the specific entry to see which services are active
      const [entryRows] = await db.query('SELECT * FROM details WHERE id = ?', [entry_id]);
      if (entryRows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      const entry = entryRows[0];

      const isPension = normalizedGroup.includes('PENSION') || normalizedGroup.includes('ADMIN') || (!normalizedGroup && entry.SERVICE_PENSION);
      const isAccounts = normalizedGroup.includes('ACCOUNTS') || (!normalizedGroup && entry.SERVICE_ACCOUNTS);
      const isGpf = normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF') || (!normalizedGroup && entry.SERVICE_GPF);

      const setClauses = ['STATUS = ?'];
      const params = [status];

      if (isPension || (!isAccounts && !isGpf)) {
        setClauses.push('SERVICE_PENSION = ?', 'REMARKS_PENSION = ?', 'AAO_PENSION = ?');
        if (isCompleted) setClauses.push('COMPLETED_AT_PENSION = NOW()');
        params.push(status, remarks || '', aao_name || 'System AAO');
      }
      if (isAccounts) {
        setClauses.push('SERVICE_ACCOUNTS = ?', 'REMARKS_ACCOUNTS = ?', 'AAO_ACCOUNTS = ?');
        if (isCompleted) setClauses.push('COMPLETED_AT_ACCOUNTS = NOW()');
        params.push(status, remarks || '', aao_name || 'System AAO');
      }
      if (isGpf) {
        setClauses.push('SERVICE_GPF = ?', 'REMARKS_GPF = ?', 'AAO_GPF = ?');
        if (isCompleted) setClauses.push('COMPLETED_AT_GPF = NOW()');
        params.push(status, remarks || '', aao_name || 'System AAO');
      }

      params.push(entry_id);
      await db.query(`UPDATE details SET ${setClauses.join(', ')} WHERE id = ?`, params);
    } else if (token_number) {
      let query = '';
      let params = [];
      if (normalizedGroup.includes('PENSION') || normalizedGroup.includes('ADMIN')) {
        query = `
          UPDATE details 
          SET SERVICE_PENSION = ?, REMARKS_PENSION = ?, AAO_PENSION = ?, STATUS = ?
              ${isCompleted ? ', COMPLETED_AT_PENSION = NOW()' : ''}
          WHERE TOKEN_NO = ?
        `;
        params = [status, remarks || '', aao_name || 'System AAO', status, token_number];
      } else if (normalizedGroup.includes('ACCOUNTS')) {
        query = `
          UPDATE details 
          SET SERVICE_ACCOUNTS = ?, REMARKS_ACCOUNTS = ?, AAO_ACCOUNTS = ?, STATUS = ?
              ${isCompleted ? ', COMPLETED_AT_ACCOUNTS = NOW()' : ''}
          WHERE TOKEN_NO = ?
        `;
        params = [status, remarks || '', aao_name || 'System AAO', status, token_number];
      } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
        query = `
          UPDATE details 
          SET SERVICE_GPF = ?, REMARKS_GPF = ?, AAO_GPF = ?, STATUS = ?
              ${isCompleted ? ', COMPLETED_AT_GPF = NOW()' : ''}
          WHERE TOKEN_NO = ?
        `;
        params = [status, remarks || '', aao_name || 'System AAO', status, token_number];
      } else {
        query = `
          UPDATE details 
          SET STATUS = ?, REMARKS_PENSION = COALESCE(?, REMARKS_PENSION), REMARKS_ACCOUNTS = COALESCE(?, REMARKS_ACCOUNTS), REMARKS_GPF = COALESCE(?, REMARKS_GPF)
          WHERE TOKEN_NO = ?
        `;
        params = [status, remarks || '', remarks || '', remarks || '', token_number];
      }
      await db.query(query, params);
    }

    if (token_number) {
      try {
        await db.query('UPDATE tokens SET status = ?, remarks = ? WHERE token_number = ?', [status, remarks || '', token_number]);
      } catch (e) {
        // Ignore
      }
    }

    res.json({ message: `Successfully updated status to ${status}` });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update token status due to server error' });
  }
});

module.exports = router;

