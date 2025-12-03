const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pharmacy_management'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');

  // Update existing records with proper RCP receipt numbers
  const updateQuery = `UPDATE transactions SET receipt_number = CONCAT('RCP-', UNIX_TIMESTAMP(date) * 1000 + id) WHERE receipt_number = '' OR receipt_number IS NULL OR receipt_number NOT LIKE 'RCP-%'`;

  db.query(updateQuery, (err, results) => {
    if (err) {
      console.error('Error updating receipt numbers:', err);
      db.end();
      return;
    }
    console.log(`Updated ${results.affectedRows} records with proper RCP receipt numbers`);
    db.end();
  });
});
