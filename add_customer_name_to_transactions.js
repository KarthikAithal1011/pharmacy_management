const mysql = require('mysql2');

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pharmacy_management'
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('MySQL Connected...');

  // Add customer_name column to transactions table
  db.query('ALTER TABLE transactions ADD COLUMN customer_name VARCHAR(255)', (err, results) => {
    if (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Column 'customer_name' already exists in 'transactions' table.");
        } else {
            console.log("Error altering transactions table:", err.sqlMessage);
        }
    } else {
        console.log("Transactions table altered successfully. Column 'customer_name' added.");
    }
    db.end();
  });
});
