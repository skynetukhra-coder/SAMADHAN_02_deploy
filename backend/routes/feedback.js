const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. SUBMIT FEEDBACK
router.post('/', async (req, res) => {
  const { token_number, rating_pension, rating_accounts, rating_gpf, comments } = req.body;

  if (!token_number) {
    return res.status(400).json({ error: 'Token number is required' });
  }

  try {
    // Insert feedback
    await db.query(
      `INSERT INTO feedback (token_number, rating_pension, rating_accounts, rating_gpf, comments, submitted_on) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [token_number, rating_pension || 0, rating_accounts || 0, rating_gpf || 0, comments || '']
    );

    // Update status in details table
    await db.query(
      `UPDATE details 
       SET SERVICE_PENSION = CASE WHEN SERVICE_PENSION = 'Completed' THEN 'Resolved' ELSE SERVICE_PENSION END,
           SERVICE_ACCOUNTS = CASE WHEN SERVICE_ACCOUNTS = 'Completed' THEN 'Resolved' ELSE SERVICE_ACCOUNTS END,
           SERVICE_GPF = CASE WHEN SERVICE_GPF = 'Completed' THEN 'Resolved' ELSE SERVICE_GPF END,
           STATUS = CASE 
             WHEN (SERVICE_PENSION IS NULL OR SERVICE_PENSION IN ('Completed', 'Resolved'))
              AND (SERVICE_ACCOUNTS IS NULL OR SERVICE_ACCOUNTS IN ('Completed', 'Resolved'))
              AND (SERVICE_GPF IS NULL OR SERVICE_GPF IN ('Completed', 'Resolved'))
             THEN 'Resolved'
             ELSE STATUS
           END
       WHERE TOKEN_NO = ?`,
      [token_number]
    );

    // Update tokens table status if overall details status becomes 'Resolved'
    const [statusRows] = await db.query('SELECT STATUS FROM details WHERE TOKEN_NO = ?', [token_number]);
    if (statusRows.length > 0 && statusRows[0].STATUS === 'Resolved') {
      await db.query(
        "UPDATE tokens SET status = 'Resolved' WHERE token_number = ?",
        [token_number]
      );
    }

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Feedback submission error:', err);
    res.status(500).json({ error: 'Failed to submit feedback. Server error.' });
  }
});

// 2. GET DASHBOARD METRICS AND RECENT FEEDBACKS
router.get('/stats', async (req, res) => {
  const { group_name } = req.query;
  const normalizedGroup = (group_name || '').trim().toUpperCase();

  try {
    let totalQuery = `
      SELECT COUNT(DISTINCT TOKEN_NO) as count FROM details 
      WHERE SERVICE_PENSION IS NOT NULL OR SERVICE_ACCOUNTS IS NOT NULL OR SERVICE_GPF IS NOT NULL
    `;
    let inProgressQuery = `
      SELECT (
        (SELECT COUNT(*) FROM details WHERE SERVICE_PENSION = 'In Progress') +
        (SELECT COUNT(*) FROM details WHERE SERVICE_ACCOUNTS = 'In Progress') +
        (SELECT COUNT(*) FROM details WHERE SERVICE_GPF = 'In Progress')
      ) as count
    `;
    let resolvedQuery = `
      SELECT (
        (SELECT COUNT(*) FROM details WHERE SERVICE_PENSION IN ('Resolved', 'Completed')) +
        (SELECT COUNT(*) FROM details WHERE SERVICE_ACCOUNTS IN ('Resolved', 'Completed')) +
        (SELECT COUNT(*) FROM details WHERE SERVICE_GPF IN ('Resolved', 'Completed'))
      ) as count
    `;

    if (normalizedGroup.includes('PENSION') || normalizedGroup.includes('ADMINISTRATION')) {
      totalQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_PENSION IS NOT NULL`;
      inProgressQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_PENSION = 'In Progress'`;
      resolvedQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_PENSION IN ('Resolved', 'Completed')`;
    } else if (normalizedGroup.includes('ACCOUNTS')) {
      totalQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_ACCOUNTS IS NOT NULL`;
      inProgressQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_ACCOUNTS = 'In Progress'`;
      resolvedQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_ACCOUNTS IN ('Resolved', 'Completed')`;
    } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
      totalQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_GPF IS NOT NULL`;
      inProgressQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_GPF = 'In Progress'`;
      resolvedQuery = `SELECT COUNT(*) as count FROM details WHERE SERVICE_GPF IN ('Resolved', 'Completed')`;
    }

    const [totalTokensRow] = await db.query(totalQuery);
    const [inProgressRow] = await db.query(inProgressQuery);
    const [resolvedRow] = await db.query(resolvedQuery);
    const [totalFeedbackRow] = await db.query('SELECT COUNT(*) as count FROM feedback');

    // Fetch only feedbacks where the specific service concerned is selected
    let feedbackFilter = '';
    if (normalizedGroup.includes('PENSION')) {
      feedbackFilter = 'WHERE d.SERVICE_PENSION IS NOT NULL';
    } else if (normalizedGroup.includes('ACCOUNTS')) {
      feedbackFilter = 'WHERE d.SERVICE_ACCOUNTS IS NOT NULL';
    } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
      feedbackFilter = 'WHERE d.SERVICE_GPF IS NOT NULL';
    }

    const [recentFeedbacks] = await db.query(`
      SELECT 
        f.token_number, 
        CASE 
          WHEN d.SERVICE_PENSION IS NOT NULL THEN 'Pension'
          WHEN d.SERVICE_ACCOUNTS IS NOT NULL THEN 'Accounts'
          ELSE 'GPF'
        END as category, 
        f.submitted_on, 
        f.comments as feedback, 
        COALESCE(
          CASE 
            WHEN ? LIKE '%PENSION%' OR ? LIKE '%ADMINISTRATION%' THEN d.REMARKS_PENSION
            WHEN ? LIKE '%ACCOUNTS%' THEN d.REMARKS_ACCOUNTS
            WHEN ? LIKE '%FUND%' OR ? LIKE '%GPF%' THEN d.REMARKS_GPF
            ELSE COALESCE(d.REMARKS_PENSION, d.REMARKS_ACCOUNTS, d.REMARKS_GPF)
          END,
          ''
        ) as remarks,
        'Completed' as status 
      FROM feedback f
      LEFT JOIN details d ON f.token_number = d.TOKEN_NO
      ${feedbackFilter}
      ORDER BY f.submitted_on DESC
      LIMIT 10
    `, [normalizedGroup, normalizedGroup, normalizedGroup, normalizedGroup, normalizedGroup, normalizedGroup]);

    // Clear all offline mock/sample fallback data, returning only actual database values
    const responseData = {
      totalTokens: totalTokensRow[0]?.count || 0,
      inProgress: inProgressRow[0]?.count || 0,
      resolved: resolvedRow[0]?.count || 0,
      totalFeedback: totalFeedbackRow[0]?.count || 0,
      recentFeedback: recentFeedbacks
    };

    res.json(responseData);
  } catch (err) {
    console.error('Error fetching dashboard statistics:', err);
    res.status(500).json({
      totalTokens: 0,
      inProgress: 0,
      resolved: 0,
      totalFeedback: 0,
      recentFeedback: []
    });
  }
});

// 3. GET ALL DETAILED FEEDBACKS
router.get('/list', async (req, res) => {
  const { group_name } = req.query;
  const normalizedGroup = (group_name || '').trim().toUpperCase();

  try {
    let feedbackFilter = '';
    if (normalizedGroup.includes('PENSION')) {
      feedbackFilter = 'WHERE d.SERVICE_PENSION IS NOT NULL';
    } else if (normalizedGroup.includes('ACCOUNTS')) {
      feedbackFilter = 'WHERE d.SERVICE_ACCOUNTS IS NOT NULL';
    } else if (normalizedGroup.includes('FUND') || normalizedGroup.includes('GPF')) {
      feedbackFilter = 'WHERE d.SERVICE_GPF IS NOT NULL';
    }

    const [rows] = await db.query(`
      SELECT 
        f.token_number, 
        CASE 
          WHEN d.SERVICE_PENSION IS NOT NULL THEN 'Pension'
          WHEN d.SERVICE_ACCOUNTS IS NOT NULL THEN 'Accounts'
          ELSE 'GPF'
        END as category, 
        f.submitted_on, 
        f.comments as feedback, 
        COALESCE(
          CASE 
            WHEN ? LIKE '%PENSION%' OR ? LIKE '%ADMINISTRATION%' THEN d.REMARKS_PENSION
            WHEN ? LIKE '%ACCOUNTS%' THEN d.REMARKS_ACCOUNTS
            WHEN ? LIKE '%FUND%' OR ? LIKE '%GPF%' THEN d.REMARKS_GPF
            ELSE COALESCE(d.REMARKS_PENSION, d.REMARKS_ACCOUNTS, d.REMARKS_GPF)
          END,
          ''
        ) as remarks,
        'Completed' as status 
      FROM feedback f
      LEFT JOIN details d ON f.token_number = d.TOKEN_NO
      ${feedbackFilter}
      ORDER BY f.submitted_on DESC
    `, [normalizedGroup, normalizedGroup, normalizedGroup, normalizedGroup, normalizedGroup, normalizedGroup]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching feedbacks list:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
