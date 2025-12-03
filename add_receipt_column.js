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

  // Add receipt_number column if it doesn't exist
  const alterQuery = `ALTER TABLE transactions ADD COLUMN receipt_number VARCHAR(255) NOT NULL DEFAULT '' AFTER id`;

  db.query(alterQuery, (err, results) => {
    if (err) {
      console.error('Error adding column:', err);
      db.end();
      return;
    }
    console.log('Column receipt_number added successfully');
    db.end();
  });
});
