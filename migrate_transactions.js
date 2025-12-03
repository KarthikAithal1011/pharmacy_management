const mysql = require('mysql2/promise');

async function migrateData() {
  let db;
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'pharmacy_management'
    });

    console.log('MySQL Connected...');

    // Get all transactions
    const [transactions] = await db.query('SELECT date, total_after_discount FROM transactions');
    console.log(`Found ${transactions.length} historical transaction days.`);

    let migratedCount = 0;

    for (const transaction of transactions) {
      const transactionDate = transaction.date;
      const total = transaction.total_after_discount;

      // Check if any receipts already exist for that date
      const [existingReceipts] = await db.query('SELECT COUNT(*) as count FROM receipts WHERE date = ?', [transactionDate]);
      
      if (existingReceipts[0].count === 0) {
        // If no receipts exist for this day, migrate the daily total as a single receipt
        console.log(`No receipts found for ${transactionDate.toISOString().split('T')[0]}. Migrating daily total...`);

        const receiptId = `MIG-${transactionDate.toISOString().split('T')[0]}`;
        const customerName = 'Migrated Daily Total';

        await db.query(
          'INSERT INTO receipts (receipt_id, customer_name, date, total_after_discount) VALUES (?, ?, ?, ?)',
          [receiptId, customerName, transactionDate, total]
        );
        migratedCount++;
      } else {
        console.log(`Receipts already exist for ${transactionDate.toISOString().split('T')[0]}. Skipping migration for this day.`);
      }
    }

    console.log(`Migration complete. Migrated ${migratedCount} daily totals into the receipts table.`);

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    if (db) {
      await db.end();
      console.log('MySQL connection closed.');
    }
  }
}

migrateData();
