const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'samadhan_db'
};

async function run() {
  const connection = await mysql.createConnection(dbConfig);
  console.log('Connected to MySQL database.');

  // 1. Re-create users table
  await connection.query(`DROP TABLE IF EXISTS users`);
  await connection.query(`
    CREATE TABLE users (
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
  console.log('Re-created users table.');

  // 2. Read CSV file
  const csvPath = 'C:\\Users\\Administrator\\Downloads\\users5.csv';
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/);

  console.log(`Read ${lines.length} lines from CSV.`);

  let successCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 7) {
      console.warn(`Skipping invalid line ${i + 1}: ${line}`);
      continue;
    }

    const username = parts[1].trim();
    const rawPassword = parts[2].trim();
    const fullName = parts[3].trim();
    const designation = parts[4].trim();
    const groupName = parts[5].trim();
    const email = parts[6].trim();

    if (!username || !rawPassword || !email) {
      continue;
    }

    try {
      await connection.query(
        `INSERT INTO users (username, password, full_name, designation, group_name, email) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, rawPassword, fullName, designation, groupName, email]
      );
      successCount++;
    } catch (err) {
      console.error(`Error inserting user at line ${i + 1} (${username}):`, err.message);
    }
  }

  console.log(`Successfully imported ${successCount} users.`);
  await connection.end();
}

run().catch(console.error);
