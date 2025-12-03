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
  console.log('Connected to MySQL database.');

  const alterTableQuery = `
    ALTER TABLE receipts
    ADD COLUMN total_before_discount DECIMAL(10, 2) NULL DEFAULT 0,
    ADD COLUMN total_after_discount DECIMAL(10, 2) NULL DEFAULT 0;
  `;

  db.query(alterTableQuery, (err) => {
    if (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.warn('Columns total_before_discount and total_after_discount already exist. Skipping.');
      } else {
        console.error('Error altering receipts table:', err);
      }
    } else {
      console.log('Successfully added total_before_discount and total_after_discount columns to receipts table.');
    }
    db.end();
  });
});
