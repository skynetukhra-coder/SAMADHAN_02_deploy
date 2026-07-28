const mysql = require('mysql2/promise');
const XLSX = require('xlsx');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'samadhan_db'
};

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  console.log('Connected to MySQL database.');

  // 1. Read Excel file
  const workbook = XLSX.readFile('C:\\Users\\Administrator\\Downloads\\Hooghly_PSA_list.xls');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`Read ${rows.length} rows from Excel.`);

  // 2. Fetch existing DDO codes from details table
  const [existingRows] = await conn.query('SELECT TOKEN_NO, PSA_CODE FROM details');
  const existingCodes = new Set(existingRows.map(r => r.PSA_CODE).filter(Boolean));
  console.log(`Found ${existingRows.length} existing rows in details table (${existingCodes.size} unique codes).`);

  // 3. Find max token number
  const [maxRes] = await conn.query("SELECT TOKEN_NO FROM details WHERE TOKEN_NO LIKE 'TKN%'");
  let maxIdx = 0;
  for (const r of maxRes) {
    const num = parseInt(r.TOKEN_NO.replace('TKN', ''), 10);
    if (!isNaN(num) && num > maxIdx) {
      maxIdx = num;
    }
  }
  console.log(`Current maximum TKN index: ${maxIdx}`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const psaName = (row.PSA_NAME || '').trim();
    const psaCode = (row.PSA_CODE || '').trim();
    const address = (row.ADDRESS || '').trim();

    if (!psaName || !psaCode) {
      console.log(`Skipping invalid Excel row:`, row);
      continue;
    }

    if (existingCodes.has(psaCode)) {
      // DDO code already exists, update PSA name and address for existing rows with this code
      await conn.query(
        'UPDATE details SET PSA_NAME = ?, ADDRESS = ? WHERE PSA_CODE = ?',
        [psaName, address, psaCode]
      );
      updatedCount++;
    } else {
      // New DDO, insert with a new token number
      maxIdx++;
      const tokenNo = 'TKN' + String(maxIdx).padStart(3, '0');
      await conn.query(
        `INSERT INTO details (TOKEN_NO, PSA_NAME, PSA_CODE, ADDRESS) 
         VALUES (?, ?, ?, ?)`,
        [tokenNo, psaName, psaCode, address]
      );
      existingCodes.add(psaCode);
      insertedCount++;
    }
  }

  console.log(`Import completed. Inserted ${insertedCount} new DDOs, updated ${updatedCount} existing DDOs.`);
  
  // Print final row count
  const [finalCount] = await conn.query('SELECT COUNT(*) as count FROM details');
  console.log(`Final details row count: ${finalCount[0].count}`);

  await conn.end();
}

run().catch(console.error);
