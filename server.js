const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const port = 3000;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pharmacy_management'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }

  // Use the database
  db.changeUser({ database: 'pharmacy_management' }, (err) => {
    if (err) throw err;

  });
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'pharmacy_secret',
  resave: false,
  saveUninitialized: true
}));

// Serve static files
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  if (req.session.loggedin) {
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: null });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Please enter both username and password.' });
  }
  db.query('SELECT * FROM admin_login WHERE username = ? AND password = ?', [username, password], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      req.session.loggedin = true;
      req.session.username = username;
      res.redirect('/dashboard');
    } else {
      res.render('login', { error: 'Incorrect username or password.' });
    }
  });
});

app.get('/dashboard', (req, res) => {
  if (req.session.loggedin) {
    // Fetch from stock_available table
    db.query('SELECT * FROM stock_available', (err, results) => {
      if (err) {
        console.error('Error fetching stock:', err);
        res.render('dashboard', { username: req.session.username, medicines: [], purchases: req.session.purchases || [], error: null, success: null });
      } else {
        res.render('dashboard', {
          username: req.session.username,
          medicines: results,
          purchases: req.session.purchases || [],
          error: req.query.error || null,
          success: req.query.success || null
        });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.post('/add-to-cart', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const { medicine, quantity } = req.body;
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.redirect('/dashboard?error=Invalid quantity');
  }
  // Check if medicine exists and get tablets per strip (but don't deduct stock yet)
  db.query('SELECT tablets_in_a_strip FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      return res.redirect('/dashboard?error=Medicine not found');
    }
    // Initialize purchases array if not exists
    if (!req.session.purchases) {
      req.session.purchases = [];
    }
    // Add purchase to session (without deducting stock yet)
    req.session.purchases.push({ medicine, quantity: qty });
    res.redirect('/dashboard?success=Added to cart');
  });
});

app.post('/remove-from-cart', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const { index } = req.body;
  const idx = parseInt(index);
  if (isNaN(idx) || idx < 0 || !req.session.purchases || idx >= req.session.purchases.length) {
    return res.redirect('/dashboard?error=Invalid item');
  }
  req.session.purchases.splice(idx, 1);
  res.redirect('/dashboard?success=Item removed from cart');
});

app.post('/clear-cart', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  req.session.purchases = [];
  res.redirect('/dashboard?success=Cart cleared');
});

app.post('/buy', (req, res) => {
  if (!req.session.loggedin || !req.session.purchases || req.session.purchases.length === 0) {
    return res.redirect('/dashboard');
  }
  // Deduct stock for all purchases - only deduct complete strips when equivalent tablets are bought
  let errors = [];
  let completed = 0;
  req.session.purchases.forEach((purchase, index) => {
    db.query('SELECT stock, tablets_in_a_strip, tablets_used_in_current_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
      if (err) {
        errors.push(`Error checking stock for ${purchase.medicine}`);
        return;
      }
      if (results.length === 0) {
        errors.push(`Medicine ${purchase.medicine} not found`);
        return;
      }
      const currentStock = results[0].stock;
      const tabletsInStrip = results[0].tablets_in_a_strip;
      const tabletsUsedInCurrentStrip = results[0].tablets_used_in_current_strip || 0;

      // Calculate total available tablets
      const tabletsAvailableInCurrentStrip = tabletsInStrip - tabletsUsedInCurrentStrip;
      const tabletsAvailableInFullStrips = currentStock * tabletsInStrip;
      const totalTabletsAvailable = tabletsAvailableInCurrentStrip + tabletsAvailableInFullStrips;

      if (totalTabletsAvailable < purchase.quantity) {
        errors.push(`Insufficient stock for ${purchase.medicine}`);
        return;
      }

      let tabletsToProcess = purchase.quantity;
      let newStock = currentStock;
      let newTabletsUsedInCurrentStrip = tabletsUsedInCurrentStrip;

      // Add the purchased tablets to the used counter
      newTabletsUsedInCurrentStrip += tabletsToProcess;

      // Check if we've completed any full strips
      const completeStripsToDeduct = Math.floor(newTabletsUsedInCurrentStrip / tabletsInStrip);
      if (completeStripsToDeduct > 0) {
        newStock -= completeStripsToDeduct;
        newTabletsUsedInCurrentStrip = newTabletsUsedInCurrentStrip % tabletsInStrip;
      }

      // Update the database
      db.query('UPDATE stock_available SET stock = ?, tablets_used_in_current_strip = ? WHERE medicine = ?',
        [newStock, newTabletsUsedInCurrentStrip, purchase.medicine], (err) => {
        if (err) {
          errors.push(`Error updating stock for ${purchase.medicine}`);
          return;
        }
        completed++;
        if (completed === req.session.purchases.length) {
          if (errors.length > 0) {
            return res.redirect('/dashboard?error=' + encodeURIComponent(errors.join(', ')));
          }
          res.redirect('/receipts');
        }
      });
    });
  });
});

app.post('/add-stock', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const { medicine, quantity } = req.body;
  const qty = parseInt(quantity);

  if (!medicine || medicine.trim() === '' || isNaN(qty) || qty <= 0) {
    return res.send('Invalid medicine name or quantity');
  }

  // Check if medicine exists
  db.query('SELECT stock FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      return res.send('Medicine not found. Use "Add New Medicine" to add new medicines.');
    }
    // Update existing stock
    const newStock = results[0].stock + qty;
    db.query('UPDATE stock_available SET stock = ? WHERE medicine = ?', [newStock, medicine], (err) => {
      if (err) throw err;
      res.redirect('/dashboard');
    });
  });
});

app.post('/add-medicine', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const { medicine, quantity, price_per_strip, tablets_in_a_strip } = req.body;
  const qty = parseInt(quantity);
  const price = parseFloat(price_per_strip);
  const tablets = parseInt(tablets_in_a_strip);

  if (!medicine || medicine.trim() === '' || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0 || isNaN(tablets) || tablets <= 0) {
    return res.redirect('/dashboard?error=Invalid input data. Please check all fields.');
  }

  // Check if medicine already exists
  db.query('SELECT medicine FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) {
      console.error('Error checking medicine existence:', err);
      return res.redirect('/dashboard?error=Database error occurred. Please try again.');
    }
    if (results.length > 0) {
      return res.redirect('/dashboard?error=Medicine already exists. Use "Add Stock" to increase stock for existing medicines.');
    }
    // Insert new medicine with all details
    db.query('INSERT INTO stock_available (medicine, stock, price_per_strip, tablets_in_a_strip, tablets_used_in_current_strip) VALUES (?, ?, ?, ?, 0)', [medicine, qty, price, tablets], (err) => {
      if (err) {
        console.error('Error adding medicine:', err);
        return res.redirect('/dashboard?error=Failed to add medicine. Please try again.');
      }
      res.redirect('/dashboard?success=Medicine added successfully');
    });
  });
});

app.get('/receipts', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const purchases = req.session.purchases || [];

  // Fetch price details for each purchase
  if (purchases.length > 0) {
    let processedPurchases = [];
    let completed = 0;

    purchases.forEach((purchase, index) => {
      db.query('SELECT price_per_strip, tablets_in_a_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
        if (err) {
          console.error('Error fetching price for receipts:', err);
          return;
        }
        if (results.length > 0) {
          const pricePerStrip = results[0].price_per_strip;
          const tabletsInStrip = results[0].tablets_in_a_strip;
          const pricePerTablet = pricePerStrip / tabletsInStrip;
          const total = purchase.quantity * pricePerTablet;

          processedPurchases.push({
            medicine: purchase.medicine,
            quantity: purchase.quantity,
            pricePerTablet: pricePerTablet,
            total: total
          });
        }

        completed++;
        if (completed === purchases.length) {
          res.render('receipts', {
            purchases: processedPurchases
          });
        }
      });
    });
  } else {
    res.render('receipts', {
      purchases: []
    });
  }
});

app.post('/generate-receipts', (req, res) => {
  if (!req.session.loggedin || !req.session.purchases) {
    return res.redirect('/');
  }
  const { patientName } = req.body;
  req.session.patientName = patientName;
  res.redirect('/receipts');
});

app.get('/download-pdf', (req, res) => {
  if (!req.session.loggedin || !req.session.purchases || req.session.purchases.length === 0) {
    return res.redirect('/');
  }

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=receipt.pdf');
  doc.pipe(res);

  // Pharmacy Header
  doc.fontSize(24).text('PharmacyPro', { align: 'center' });
  doc.fontSize(12).text('123 Health Street, Wellness City, WC 12345', { align: 'center' });
  doc.text('Phone: (123) 456-7890 | Email: info@pharmacypro.com', { align: 'center' });
  doc.moveDown(2);

  // Receipt Title
  doc.fontSize(18).text('RECEIPT', { align: 'center' });
  doc.moveDown();

  // Border for header
  doc.rect(50, 50, 500, 100).stroke();
  doc.moveDown(2);

  // Patient and Date Info
  doc.fontSize(12);
  doc.text(`Patient Name: ${req.session.patientName || 'Patient'}`, 60, doc.y);
  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  doc.text(`Date: ${formattedDate}`, 350, doc.y - 12);
  doc.moveDown(2);

  // Table Header
  doc.fontSize(14).text('Item Details', { underline: true });
  doc.moveDown();

  // Calculate table height based on number of items
  const tableHeight = 40 + (req.session.purchases.length * 20);
  const tableTop = doc.y;
  doc.rect(50, tableTop, 500, tableHeight).stroke();

  // Table Headers
  doc.fontSize(12);
  doc.text('Medicine', 60, tableTop + 10);
  doc.text('Quantity (Tablets)', 250, tableTop + 10);
  doc.text('Price per Tablet', 380, tableTop + 10);
  doc.text('Total', 480, tableTop + 10);

  let grandTotal = 0;
  let currentY = tableTop + 30;

  // Process each purchase
  req.session.purchases.forEach((purchase, index) => {
    // Fetch price details from database for each medicine
    db.query('SELECT price_per_strip, tablets_in_a_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
      if (err) {
        console.error('Error fetching price:', err);
        return;
      }
      if (results.length === 0) {
        return;
      }
      const pricePerStrip = results[0].price_per_strip;
      const tabletsInStrip = results[0].tablets_in_a_strip;
      const pricePerTablet = pricePerStrip / tabletsInStrip;
      const quantityTablets = purchase.quantity;
      const total = quantityTablets * pricePerTablet;
      grandTotal += total;

      // Add row to table
      doc.text(`${purchase.medicine}`, 60, currentY);
      doc.text(`${quantityTablets}`, 250, currentY);
      doc.text(`₹${pricePerTablet.toFixed(2)}`, 380, currentY);
      doc.text(`₹${total.toFixed(2)}`, 480, currentY);

      currentY += 20;

      // If this is the last item, finish the PDF
      if (index === req.session.purchases.length - 1) {
        doc.moveDown(4);

        // Total Section
        doc.fontSize(14).text(`Grand Total: ₹${grandTotal.toFixed(2)}`, { align: 'right' });
        doc.moveDown(2);

        // Footer
        doc.fontSize(10).text('Thank you for choosing PharmacyPro!', { align: 'center' });
        doc.text('Please keep this receipt for your records.', { align: 'center' });

        doc.end();
      }
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
