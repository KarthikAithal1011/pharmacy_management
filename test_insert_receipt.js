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

  const receiptId = `RCP-${new Date().getTime()}`;
  const customerName = 'Test Customer';
  const dateStr = new Date().toISOString().split('T')[0];
  const grandTotal = 100.50;
  const discountedTotal = 95.00;

  const query = 'INSERT INTO receipts (receipt_id, customer_name, date, total_before_discount, total_after_discount) VALUES (?, ?, ?, ?, ?)';
  const values = [receiptId, customerName, dateStr, grandTotal, discountedTotal];

  console.log('Executing query:', query);
  console.log('With values:', values);

  db.query(query, values, (insertErr) => {
    if (insertErr) {
      console.error('Database error inserting receipt record:', insertErr);
      console.error('Error code:', insertErr.code);
      console.error('Error message:', insertErr.message);
    } else {
      console.log('Successfully inserted receipt record.');
    }
    db.end();
  });
});
