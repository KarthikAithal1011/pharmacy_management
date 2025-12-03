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

  db.query('DESCRIBE receipts', (err, results) => {
    if (err) {
      console.error('Error describing receipts table:', err);
    } else {
      console.log('Receipts table structure:');
      console.table(results);
    }
    db.end();
  });
});
