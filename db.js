const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'samadhan_db'
};

let pool = null;

async function getPool() {
  if (pool) return pool;

  try {
    // First establish a connection without a database to ensure we can create it
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await connection.end();

    // Create the pool
    pool = mysql.createPool(dbConfig);
    console.log('MySQL Connection Pool created successfully.');
    
    // Initialize database tables
    await initializeDb();
    
    return pool;
  } catch (error) {
    console.error('================================================================');
    console.error('DATABASE CONNECTION WARNING: Could not connect to MySQL.');
    console.error('Details:', error.message);
    console.error('Please configure your credentials in the backend .env file and restart.');
    console.error('================================================================');
    return null;
  }
}

async function initializeDb() {
  if (!pool) return;

  const conn = await pool.getConnection();
  try {
    // 1. Create Users Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        designation VARCHAR(100) NOT NULL,
        group_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        psa_ddo VARCHAR(255),
        psa_ddo_code VARCHAR(100),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);



    // 2. Create Tokens Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        token_number VARCHAR(50) PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        allocated_table VARCHAR(50),
        remarks TEXT,
        submitted_on DATETIME NOT NULL
      )
    `);

    // 3. Create Feedback Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token_number VARCHAR(50) NOT NULL,
        rating_pension INT DEFAULT 0,
        rating_accounts INT DEFAULT 0,
        rating_gpf INT DEFAULT 0,
        comments TEXT,
        submitted_on DATETIME NOT NULL,
        FOREIGN KEY (token_number) REFERENCES tokens(token_number) ON DELETE CASCADE
      )
    `);

    // Seed mock data for dashboard metrics and feedback table
    const [existingTokens] = await conn.query('SELECT COUNT(*) as count FROM tokens');
    if (existingTokens[0].count === 0) {
      console.log('Seeding initial tokens and feedback database...');
      
      const tokensSeed = [
        ['TK2024-00125', 'Pension', 'In Progress', 'Table 1', 'Allocated for audit', '2024-05-20 10:45:00'],
        ['TK2024-00118', 'Accounts', 'Resolved', 'Table 3', 'Quick resolution', '2024-05-18 14:30:00'],
        ['TK2024-00110', 'GPF', 'Resolved', 'Table 2', 'GPF withdrawal approved', '2024-05-15 11:20:00'],
        ['TK2024-00098', 'Pension', 'Closed', 'Table 1', 'Pension booklet handed over', '2024-05-10 09:15:00'],
        ['TK2024-00085', 'Accounts', 'Pending', null, null, '2024-05-25 11:00:00'],
        ['TK2024-00072', 'GPF', 'In Progress', 'Table 4', 'Verifying documents', '2024-05-25 12:30:00']
      ];

      for (const t of tokensSeed) {
        await conn.query(
          'INSERT INTO tokens (token_number, category, status, allocated_table, remarks, submitted_on) VALUES (?, ?, ?, ?, ?, ?)',
          t
        );
      }

      const feedbackSeed = [
        ['TK2024-00125', 4, 3, 0, 'The staff was helpful and the process was smooth.', '2024-05-20 10:45:00'],
        ['TK2024-00118', 0, 5, 0, 'Quick response and issue resolved successfully.', '2024-05-18 14:30:00'],
        ['TK2024-00110', 0, 0, 5, 'Information provided was clear and accurate.', '2024-05-15 11:20:00'],
        ['TK2024-00098', 3, 0, 0, 'Need more counters during peak hours.', '2024-05-10 09:15:00']
      ];

      for (const f of feedbackSeed) {
        await conn.query(
          'INSERT INTO feedback (token_number, rating_pension, rating_accounts, rating_gpf, comments, submitted_on) VALUES (?, ?, ?, ?, ?, ?)',
          f
        );
      }

      console.log('Database seeded successfully.');
    }

  } catch (err) {
    console.error('Error initializing tables:', err.message);
  } finally {
    conn.release();
  }
}

// Export a function that queries database, handling errors gracefully
async function query(sql, params) {
  const p = await getPool();
  if (!p) {
    throw new Error('Database pool not initialized. Check connection credentials.');
  }
  return p.query(sql, params);
}

module.exports = {
  query,
  getPool
};
