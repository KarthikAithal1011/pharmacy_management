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

  // Show all tables
  db.query('SHOW TABLES', (err, results) => {
    if (err) {
      console.error('Error showing tables:', err);
      db.end();
      return;
    }
    console.log('Tables in database:');
    results.forEach(row => {
      console.log(Object.values(row)[0]);
    });

    // Check if receipts table exists
    const tableName = 'receipts';
    db.query('DESCRIBE ??', [tableName], (err, results) => {
      if (err) {
        console.log(`Table '${tableName}' does not exist or error:`, err.message);
      } else {
        console.log(`Table '${tableName}' structure:`);
        console.log(results);
      }
      db.end();
    });
  });
});
