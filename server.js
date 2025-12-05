const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const ejsLayouts = require('express-ejs-layouts');
const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

function generateReceiptNumber() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RCP-${dateStr}-${randomNum}`;
}

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pharmacy_management'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'pharmacy_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(ejsLayouts);
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('public'));

// Root route - serve login page
app.get('/', (req, res) => {
  res.render('login', { error: null, showNav: false });
});

app.post('/confirm-purchase', (req, res) => {
  if (!req.session.loggedin) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const { purchases, grandTotal, discountPercent, discountAmount, discountedTotal } = req.body;

  if (!purchases || purchases.length === 0) {
    return res.status(400).json({ success: false, message: 'No purchases to confirm' });
  }

  // Insert transaction record for daily collection
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  // First, check if a record for today exists
  db.query('SELECT * FROM transactions WHERE date = ?', [dateStr], (err, results) => {
    if (err) {
      console.error('Error checking daily collection:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length > 0) {
      // Update existing record
      const currentBefore = parseFloat(results[0].total_before_discount) || 0;
      const currentAfter = parseFloat(results[0].total_after_discount) || 0;

      db.query('UPDATE transactions SET total_before_discount = ?, total_after_discount = ? WHERE date = ?',
        [currentBefore + grandTotal, currentAfter + discountedTotal, dateStr], (err) => {
        if (err) {
          console.error('Error updating daily collection:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        // Also insert into receipts table
        const receiptNumber = generateReceiptNumber();
        db.query('INSERT INTO receipts (receipt_id, customer_name, date, total_after_discount) VALUES (?, ?, ?, ?)',
          [receiptNumber, 'Walk-in Customer', dateStr, discountedTotal], (err) => {
          if (err) {
            console.error('Error inserting receipt:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          res.json({ success: true, message: 'Purchase confirmed successfully' });
        });
      });
    } else {
      // Insert new record with receipt_id and customer_name
      const receiptNumber = generateReceiptNumber();
      db.query('INSERT INTO transactions (date, receipt_id, customer_name, total_before_discount, total_after_discount) VALUES (?, ?, ?, ?, ?)',
        [dateStr, receiptNumber, 'Walk-in Customer', grandTotal, discountedTotal], (err) => {
        if (err) {
          console.error('Error inserting daily collection:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        // Also insert into receipts table
        db.query('INSERT INTO receipts (receipt_id, customer_name, date, total_after_discount) VALUES (?, ?, ?, ?)',
          [receiptNumber, 'Walk-in Customer', dateStr, discountedTotal], (err) => {
          if (err) {
            console.error('Error inserting receipt:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          res.json({ success: true, message: 'Purchase confirmed successfully' });
        });
      });
    }
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Please enter both username and password.', showNav: false });
  }
  db.query('SELECT * FROM admin_login WHERE username = ? AND password = ?', [username, password], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      req.session.loggedin = true;
      req.session.username = username;
      req.session.formData = {}; // Clear form data on login
      res.redirect('/menu');
    } else {
      res.render('login', { error: 'Incorrect username or password.', showNav: false });
    }
  });
});

app.get('/menu', (req, res) => {
  if (req.session.loggedin) {
    // Fetch from stock_available table
    db.query('SELECT * FROM stock_available', (err, stockResults) => {
      if (err) {
        console.error('Error fetching stock:', err);
        res.render('menu', { username: req.session.username, medicines: [], transactions: [], error: null, success: null, showNav: true, showHeader: true });
      } else {
        // Fetch recent transactions (last 10)
        db.query('SELECT id, date, total_after_discount FROM transactions ORDER BY date DESC LIMIT 10', (err, transactionResults) => {
          if (err) {
            console.error('Error fetching transactions:', err);
            transactionResults = [];
          }
          res.render('menu', {
            username: req.session.username,
            medicines: stockResults,
            transactions: transactionResults,
            error: req.query.error || null,
            success: req.query.success || null,
            showHeader: true,
            showNav: true
          });
        });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/view-dashboard', (req, res) => {
  if (req.session.loggedin) {
    // Clear form data if clear=true is in query or if no error/cartError and not clearing cart
    let clearLocalStorage = false;
    if (req.query.clear === 'true' || (!req.query.error && !req.query.cartError && req.query.success !== 'Cart cleared')) {
      req.session.formData = {};
      clearLocalStorage = true;
    }
    // Fetch from stock_available table
    db.query('SELECT * FROM stock_available', (err, results) => {
      if (err) {
        console.error('Error fetching stock:', err);
        res.render('dashboard', { username: req.session.username, medicines: [], purchases: req.session.purchases || [], error: null, success: null, cartError: null, formData: req.session.formData || {}, clearLocalStorage: clearLocalStorage, showNav: false });
      } else {
        res.render('dashboard', {
          username: req.session.username,
          medicines: results,
          purchases: req.session.purchases || [],
          error: req.query.error || null,
          success: req.query.success || null,
          cartError: req.query.cartError || null,
          formData: req.session.formData || {},
          clearForm: req.query.success === 'Added to cart',
          clearLocalStorage: clearLocalStorage,
          showNav: false
        });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/cart-view', (req, res) => {
  if (!req.session.loggedin) {
    return res.status(401).send('Not logged in');
  }
  res.render('_cart', { purchases: req.session.purchases || [], layout: false });
});

app.get('/add-stock', (req, res) => {
  if (req.session.loggedin) {
    // Fetch from stock_available table
    db.query('SELECT * FROM stock_available', (err, results) => {
      if (err) {
        console.error('Error fetching stock:', err);
        res.render('add_stock', { username: req.session.username, medicines: [], showNav: false });
      } else {
        res.render('add_stock', { username: req.session.username, medicines: results, showNav: false });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/add-medicine', (req, res) => {
  if (req.session.loggedin) {
    res.render('add_medicine', { username: req.session.username, showNav: false });
  } else {
    res.redirect('/');
  }
});

app.post('/add-to-cart', (req, res) => {
  if (!req.session.loggedin) {
    return res.status(401).json({ success: false, message: 'Not logged in' });
  }
  const { medicine, quantity } = req.body;
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid quantity' });
  }

  db.query('SELECT tablets_in_a_strip, stock, tablets_used_in_current_strip FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'Medicine not found' });
    }
    if (results[0].stock <= 0) {
      return res.status(400).json({ success: false, message: 'Medicine out of stock' });
    }
    const tabletsInStrip = results[0].tablets_in_a_strip;
    const stock = results[0].stock;
    const tabletsUsed = results[0].tablets_used_in_current_strip || 0;
    const totalAvailableTablets = (stock * tabletsInStrip) - tabletsUsed;

    if (!req.session.purchases) {
      req.session.purchases = [];
    }

    const existingPurchaseIndex = req.session.purchases.findIndex(p => p.medicine === medicine);
    let newTotalQuantity = qty;

    if (existingPurchaseIndex > -1) {
      newTotalQuantity += req.session.purchases[existingPurchaseIndex].quantity;
    }

    // Check against total available tablets
    if (newTotalQuantity > totalAvailableTablets) {
      return res.status(400).json({ success: false, message: 'Total quantity exceeds available stock.' });
    }

    // If validation passes, update or add the item
    if (existingPurchaseIndex > -1) {
      req.session.purchases[existingPurchaseIndex].quantity = newTotalQuantity;
    } else {
      req.session.purchases.push({ medicine, quantity: qty });
    }
    
    req.session.formData = {};
    
    res.json({ success: true, message: 'Cart updated' });
  });
});

app.post('/remove-from-cart', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const { index } = req.body;
  const idx = parseInt(index);
  if (isNaN(idx) || idx < 0 || !req.session.purchases || idx >= req.session.purchases.length) {
    return res.redirect('/view-dashboard?error=Invalid item');
  }
  req.session.purchases.splice(idx, 1);
  res.redirect('/view-dashboard?success=Item removed from cart');
});

app.post('/clear-cart', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/view-dashboard');
  }
  req.session.purchases = [];
  res.redirect('/view-dashboard?success=Cart cleared');
});

app.post('/buy', (req, res) => {
    if (!req.session.loggedin || !req.session.purchases || req.session.purchases.length === 0) {
      return res.redirect('/menu');
    }
  
    // Store purchases for receipt generation and confirmation
    req.session.receiptPurchases = req.session.purchases.slice();
  
        // Redirect to receipts page for confirmation
    res.redirect('/receipts');
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
      res.redirect('/menu');
    });
  });
});

app.post('/add-medicine', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const { medicine, quantity, price_per_strip, tablets_in_a_strip, expiry_date } = req.body;
  const qty = parseInt(quantity);
  const price = parseFloat(price_per_strip);
  const tablets = parseInt(tablets_in_a_strip);

  if (!medicine || medicine.trim() === '' || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0 || isNaN(tablets) || tablets <= 0 || !expiry_date) {
    return res.redirect('/view-dashboard?error=Invalid input data. Please check all fields.');
  }

  // Check if medicine already exists
  db.query('SELECT medicine FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) {
      console.error('Error checking medicine existence:', err);
      return res.redirect('/view-dashboard?error=Database error occurred. Please try again.');
    }
    if (results.length > 0) {
      return res.redirect('/view-dashboard?error=Medicine already exists. Use "Add Stock" to increase stock for existing medicines.');
    }
    // Insert new medicine with all details including expiry_date
    db.query('INSERT INTO stock_available (medicine, stock, price_per_strip, tablets_in_a_strip, tablets_used_in_current_strip, expiry_date) VALUES (?, ?, ?, ?, 0, ?)', [medicine, qty, price, tablets, expiry_date], (err) => {
      if (err) {
        console.error('Error adding medicine:', err);
      res.redirect('/view-dashboard?error=Failed to add medicine. Please try again.');
      }
      res.redirect('/menu?success=Medicine added successfully');
    });
  });
});

app.get('/receipts', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }
  const purchases = req.session.receiptPurchases || [];

  // Fetch price details for each purchase
  if (purchases.length > 0) {
    let processedPurchases = [];
    let completed = 0;

    purchases.forEach((purchase, index) => {
      db.query('SELECT price_per_strip, tablets_in_a_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
        if (err) {
          console.error('Error fetching price for receipts:', err);
          completed++;
          if (completed === purchases.length) {
            let grandTotal = processedPurchases.reduce((sum, p) => sum + p.total, 0);
            let discountPercent = 0;
            if (grandTotal > 1000) discountPercent = 15;
            else if (grandTotal > 500) discountPercent = 5;
            else if (grandTotal > 200) discountPercent = 3;
            let discountAmount = grandTotal * discountPercent / 100;
            let discountedTotal = grandTotal - discountAmount;
          res.render('receipts', {
            purchases: processedPurchases,
            grandTotal: grandTotal,
            discountPercent: discountPercent,
            discountAmount: discountAmount,
            discountedTotal: discountedTotal,
            generated: req.query.generated === 'true',
            confirmed: req.query.confirmed === 'true',
            patientName: req.session.patientName || ''
          });
          }
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
          let grandTotal = processedPurchases.reduce((sum, p) => sum + p.total, 0);
          let discountPercent = 0;
          if (grandTotal > 1000) discountPercent = 15;
          else if (grandTotal > 500) discountPercent = 5;
          else if (grandTotal > 200) discountPercent = 3;
          let discountAmount = grandTotal * discountPercent / 100;
          let discountedTotal = grandTotal - discountAmount;

          res.render('receipts', {
            purchases: processedPurchases,
            grandTotal: grandTotal,
            discountPercent: discountPercent,
            discountAmount: discountAmount,
            discountedTotal: discountedTotal,
            generated: req.query.generated === 'true',
            confirmed: req.query.confirmed === 'true',
            patientName: req.session.patientName || ''
          });
        }
      });
    });
  } else {
    res.render('receipts', {
      purchases: [],
      grandTotal: 0,
      discountPercent: 0,
      discountAmount: 0,
      discountedTotal: 0,
      generated: req.query.generated === 'true',
      confirmed: req.query.confirmed === 'true',
      patientName: req.session.patientName || ''
    });
  }
});

app.post('/generate-receipts', (req, res) => {
    if (!req.session.loggedin) {
      // For AJAX, send a JSON error. For others, redirect.
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
      }
      return res.redirect('/');
    }
  
    const { patientName, action } = req.body;
    req.session.patientName = patientName;
  
    if (action === 'generate') {
      return res.redirect('/receipts?generated=true');
    }
  
    if (action === 'confirm') {
      const purchases = req.session.receiptPurchases;
      if (!purchases || purchases.length === 0) {
        return res.status(400).json({ success: false, message: 'No items to purchase.' });
      }
  
      let validationErrors = [];
      let validationCompleted = 0;
  
      purchases.forEach((purchase) => {
        db.query('SELECT stock, tablets_in_a_strip, tablets_used_in_current_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
          if (err) {
            validationErrors.push(`DB error checking stock for ${purchase.medicine}`);
          } else if (results.length === 0) {
            validationErrors.push(`Medicine ${purchase.medicine} not found`);
          } else {
            const { stock, tablets_in_a_strip, tablets_used_in_current_strip } = results[0];
            const totalAvailableTablets = (stock * tablets_in_a_strip) - (tablets_used_in_current_strip || 0);
            if (totalAvailableTablets < purchase.quantity) {
              validationErrors.push(`Insufficient stock for ${purchase.medicine}`);
            }
          }
          validationCompleted++;
  
          if (validationCompleted === purchases.length) {
            if (validationErrors.length > 0) {
              return res.status(400).json({ success: false, message: validationErrors.join(', ') });
            }
  
            // Validation passed, proceed to update stock
            let updateErrors = [];
            let updatesCompleted = 0;
            purchases.forEach((p) => {
              db.query('SELECT stock, tablets_in_a_strip, tablets_used_in_current_strip FROM stock_available WHERE medicine = ?', [p.medicine], (err, selectResults) => {
                if (err) {
                  updateErrors.push(`Error re-fetching stock for ${p.medicine}`);
                  updatesCompleted++;
                  if(updatesCompleted === purchases.length) {
                     return res.status(500).json({ success: false, message: updateErrors.join(', ') });
                  }
                  return;
                }
                
                const { stock, tablets_in_a_strip, tablets_used_in_current_strip } = selectResults[0];
                let newStock = stock;
                let newTabletsUsed = (tablets_used_in_current_strip || 0) + p.quantity;
                const stripsToDeduct = Math.floor(newTabletsUsed / tablets_in_a_strip);
  
                if (stripsToDeduct > 0) {
                  newStock -= stripsToDeduct;
                  newTabletsUsed %= tablets_in_a_strip;
                }
  
                db.query('UPDATE stock_available SET stock = ?, tablets_used_in_current_strip = ? WHERE medicine = ?', [newStock, newTabletsUsed, p.medicine], (updateErr) => {
                  if (updateErr) {
                    updateErrors.push(`Error updating stock for ${p.medicine}`);
                  }
                  updatesCompleted++;
                  if (updatesCompleted === purchases.length) {
                     if (updateErrors.length > 0) {
                          return res.status(500).json({ success: false, message: updateErrors.join(', ') });
                     }
  
                     // Stock update successful, now record transaction
                      let priceErrors = [];
                      let priceCompleted = 0;
                      let processedPurchases = [];
                      purchases.forEach(purchaseItem => {
                          db.query('SELECT price_per_strip, tablets_in_a_strip FROM stock_available WHERE medicine = ?', [purchaseItem.medicine], (priceErr, priceResults) => {
                              if (priceErr || priceResults.length === 0) {
                                  priceErrors.push(`Could not fetch price for ${purchaseItem.medicine}`);
                              } else {
                                  const { price_per_strip, tablets_in_a_strip } = priceResults[0];
                                  const pricePerTablet = price_per_strip / tablets_in_a_strip;
                                  processedPurchases.push({ ...purchaseItem, total: purchaseItem.quantity * pricePerTablet });
                              }
                              priceCompleted++;
                              if (priceCompleted === purchases.length) {
                                  if (priceErrors.length > 0) {
                                      return res.status(500).json({ success: false, message: priceErrors.join(', ') });
                                  }
  
                                  let grandTotal = processedPurchases.reduce((sum, item) => sum + item.total, 0);
                                  let discountPercent = 0;
                                  if (grandTotal > 1000) discountPercent = 15;
                                  else if (grandTotal > 500) discountPercent = 5;
                                  else if (grandTotal > 200) discountPercent = 3;
                                  let discountAmount = grandTotal * discountPercent / 100;
                                  let discountedTotal = grandTotal - discountAmount;
                                  
                                  const receiptId = generateReceiptNumber();
                                  const customerName = req.session.patientName || 'Walk-in Customer';
                                  const dateStr = new Date().toISOString().split('T')[0];
                                  
                                  db.query('INSERT INTO receipts (receipt_id, customer_name, date, total_after_discount) VALUES (?, ?, ?, ?)', [receiptId, customerName, dateStr, discountedTotal], (insertErr) => {
                                      if (insertErr) {
                                          return res.status(500).json({ success: false, message: 'Error inserting receipt record.' });
                                      }
                                      req.session.purchases = [];
                                      res.json({ success: true, message: 'Purchase confirmed' });
                                  });
                              }
                          });
                      });
                  }
                });
              });
            });
          }
        });
      });
    } else {
        res.redirect('/receipts?generated=true');
    }
  });

app.get('/download-pdf', (req, res) => {
  if (!req.session.loggedin || !req.session.receiptPurchases || req.session.receiptPurchases.length === 0) {
    return res.redirect('/');
  }

  const purchases = req.session.receiptPurchases;

  // Fetch all price details at once
  const queries = purchases.map(purchase => {
    return new Promise((resolve, reject) => {
      db.query('SELECT price_per_strip, tablets_in_a_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
        if (err) {
          reject(err);
        } else if (results.length === 0) {
          reject(new Error(`Medicine ${purchase.medicine} not found`));
        } else {
          resolve({
            medicine: purchase.medicine,
            quantity: purchase.quantity,
            pricePerStrip: results[0].price_per_strip,
            tabletsInStrip: results[0].tablets_in_a_strip
          });
        }
      });
    });
  });

  Promise.all(queries).then((purchaseDetails) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=receipt.pdf');
    doc.pipe(res);

    // Header with border
    doc.rect(30, 30, 535, 100).stroke();
    doc.moveTo(30, 80).lineTo(565, 80).stroke();

    // Pharmacy Header
    doc.fontSize(20).font('Helvetica-Bold').text('COMMUNITY PHARMACY', 30, 45, { width: 535, align: 'center' });
    doc.fontSize(10).font('Helvetica').text('123 Health Street, Wellness City, WC 12345', 30, 65, { width: 535, align: 'center' });
    doc.text('Phone: (123) 456-7890 | Email: info@pharmacypro.com', 30, 90, { width: 535, align: 'center' });

    // Receipt Title
    doc.moveDown(3);
    doc.fontSize(16).font('Helvetica-Bold');
    const receiptText = 'RECEIPT';
    doc.fontSize(16).text(receiptText, {
      align: 'center'
    });
    const receiptWidth = doc.widthOfString(receiptText);
    const pageWidth = doc.page.width;
    const startX = (pageWidth - receiptWidth) / 2;
    const endX = (pageWidth + receiptWidth) / 2;
    doc.moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();

    // Receipt Details
    doc.moveDown(1.5);
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    const receiptNumber = generateReceiptNumber();
    doc.fontSize(11).font('Helvetica');
    doc.text(`Receipt No: ${receiptNumber}`, 50, doc.y);
    doc.text(`Date: ${formattedDate}`, 400, doc.y);
    doc.moveDown(1);
    doc.text(`Patient Name: ${req.session.patientName || 'Walk-in Customer'}`, 50, doc.y);
    doc.text(`Time: ${today.toLocaleTimeString()}`, 400, doc.y);
    // Table Header
    doc.moveDown(2);
    const tableTop = doc.y;
    // Table border
    doc.rect(40, tableTop, 510, 40).stroke();
    // Table headers with internal lines
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('S.No', 45, tableTop + 20, { width: 30, align: 'center' });
    doc.text('Medicine Name', 85, tableTop + 20, { width: 240, align: 'center' });
    doc.text('Qty', 335, tableTop + 20, { width: 40, align: 'center' });
    doc.text('Rate', 385, tableTop + 20, { width: 70, align: 'center' });
    doc.text('Amount', 465, tableTop + 20, { width: 80, align: 'center' });

    // Vertical lines
    doc.moveTo(80, tableTop).lineTo(80, tableTop + 40).stroke();
    doc.moveTo(330, tableTop).lineTo(330, tableTop + 40).stroke();
    doc.moveTo(380, tableTop).lineTo(380, tableTop + 40).stroke();
    doc.moveTo(460, tableTop).lineTo(460, tableTop + 40).stroke();

    let currentY = tableTop + 40;
    let grandTotal = 0;

    // Process each purchase detail
    purchaseDetails.forEach((detail, index) => {
      const pricePerTablet = detail.pricePerStrip / detail.tabletsInStrip;
      const total = detail.quantity * pricePerTablet;
      grandTotal += total;

      // Item row
      const rowHeight = 30;
      doc.rect(40, currentY - 5, 510, rowHeight).stroke();
      doc.fontSize(10).font('Helvetica');
      doc.text(`${index + 1}`, 45, currentY + 10, { width: 30, align: 'center' });
      doc.text(`${detail.medicine}`, 85, currentY + 10, { width: 240, align: 'center' });
      doc.text(`${detail.quantity}`, 335, currentY + 10, { width: 40, align: 'center' });
      doc.text(`₹${pricePerTablet.toFixed(2)}`, 385, currentY + 10, { width: 70, align: 'center' });
      doc.text(`₹${total.toFixed(2)}`, 465, currentY + 10, { width: 80, align: 'center' });

      // Vertical lines for row
      doc.moveTo(80, currentY - 5).lineTo(80, currentY + 25).stroke();
      doc.moveTo(330, currentY - 5).lineTo(330, currentY + 25).stroke();
      doc.moveTo(380, currentY - 5).lineTo(380, currentY + 25).stroke();
      doc.moveTo(460, currentY - 5).lineTo(460, currentY + 25).stroke();

      currentY += rowHeight;
    });

    // Total section
    let discountPercent = 0;
    if (grandTotal > 1000) discountPercent = 15;
    else if (grandTotal > 500) discountPercent = 5;
    else if (grandTotal > 200) discountPercent = 3;
    let discountAmount = grandTotal * discountPercent / 100;
    let discountedTotal = grandTotal - discountAmount;

    doc.moveDown(1);
    doc.rect(350, doc.y, 195, 30).stroke();
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Subtotal: ₹${grandTotal.toFixed(2)}`, 360, doc.y + 8);

    if (discountPercent > 0) {
      doc.moveDown(1);
      doc.rect(350, doc.y, 195, 30).stroke();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Discount (${discountPercent}%): -₹${discountAmount.toFixed(2)}`, 360, doc.y + 8);
    }

    doc.moveDown(1);
    doc.rect(350, doc.y, 195, 30).stroke();
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Total Amount: ₹${discountedTotal.toFixed(2)}`, 360, doc.y + 8);

    // Footer
    doc.moveDown(3);
    doc.fontSize(9).font('Helvetica');
    doc.text('Thank you for choosing our pharmacy!', 0, doc.y, { align: 'center' });
    doc.text('Please keep this receipt for your records.', 0, doc.y + 12, { align: 'center' });
    doc.text('For any queries, contact us at (123) 456-7890', 0, doc.y + 24, { align: 'center' });

    // Terms and conditions
    doc.moveDown(1);
    doc.fontSize(7).font('Helvetica');
    doc.text('Terms & Conditions:', 50, doc.y);
    doc.text('• Medicines once sold cannot be returned.', 50, doc.y + 10);
    doc.text('• Keep medicines out of reach of children.', 50, doc.y + 18);
    doc.text('• Consult your doctor before taking any medication.', 50, doc.y + 26);
    doc.end();
  }).catch((err) => {
    console.error('Error generating PDF:', err);
    res.status(500).send('Error generating PDF');
  });
});

app.get('/detailed-sales', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }

  // Initial load, render with no sales data or date
  res.render('detailed_sales', {
    username: req.session.username,
    showNav: true,
    pageTitle: 'Detailed Sales'
  });
});


app.get('/daily-collection', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const query = `
    SELECT
        SUM(total_before) AS totalBeforeDiscount,
        SUM(total_after) AS totalAfterDiscount
    FROM (
        SELECT total_after_discount AS total_before, total_after_discount AS total_after FROM receipts WHERE date = ?
        UNION ALL
        SELECT total_before_discount AS total_before, total_after_discount AS total_after FROM transactions WHERE date = ?
            AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.date = transactions.date)
    ) AS combined_sales
  `;

  db.query(query, [todayStr, todayStr], (err, results) => {
    if (err) {
      console.error('Error fetching today\'s collection:', err);
      return res.status(500).send('Error fetching sales data');
    }
    const todayFormatted = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const todayTotalAfter = parseFloat(results[0] ? results[0].totalAfterDiscount || 0 : 0);
    const todayTotalBefore = parseFloat(results[0] ? results[0].totalBeforeDiscount || 0 : 0);

    res.render('daily_collection', {
      todayDate: todayFormatted,
      todayTotalAfter: todayTotalAfter,
      todayTotalBefore: todayTotalBefore
    });
  });
});

// API route for daily collection
app.get('/api/daily-collection/:date', (req, res) => {
  if (!req.session.loggedin) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const selectedDate = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const query = `
    SELECT
        SUM(total_before) AS totalBeforeDiscount,
        SUM(total_after) AS totalAfterDiscount
    FROM (
        SELECT total_after_discount AS total_before, total_after_discount AS total_after FROM receipts WHERE date = ?
        UNION ALL
        SELECT total_before_discount AS total_before, total_after_discount AS total_after FROM transactions WHERE date = ?
            AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.date = transactions.date)
    ) AS combined_sales
  `;
  db.query(query, [selectedDate, selectedDate], (err, results) => {
    if (err) {
      console.error('Error fetching collection for API:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    const totalAfter = parseFloat(results[0] ? results[0].totalAfterDiscount || 0 : 0);
    const totalBefore = parseFloat(results[0] ? results[0].totalBeforeDiscount || 0 : 0);
    
    res.json({
      date: selectedDate,
      totalAfterDiscount: totalAfter,
      totalBeforeDiscount: totalBefore
    });
  });
});

app.get('/api/detailed-sales/:date', (req, res) => {
  if (!req.session.loggedin) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const selectedDate = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const query = `
    (SELECT id, receipt_id, customer_name, date, total_after_discount FROM receipts WHERE date = ?) 
    UNION ALL
    (SELECT id, receipt_number as receipt_id, 'Migrated Daily Total' as customer_name, date, total_after_discount FROM transactions WHERE date = ? 
        AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.date = transactions.date)
    )
    ORDER BY id DESC
  `;
  db.query(query, [selectedDate, selectedDate], (err, results) => {
    if (err) {
      console.error('Error fetching detailed sales for API:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Cron job to create daily records at the end of each day (11:59 PM)
cron.schedule('59 23 * * *', () => {
  console.log('Running daily record creation job at end of day...');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Check if today's record exists
  db.query('SELECT * FROM transactions WHERE date = ?', [todayStr], (err, results) => {
    if (err) {
      console.error('Error checking today\'s record:', err);
      return;
    }

    // If no record exists for today, create one with 0 values
    if (results.length === 0) {
      const noSalesReceiptId = `NO-SALES-${todayStr}`;
      db.query('INSERT INTO transactions (date, receipt_id, customer_name, total_before_discount, total_after_discount) VALUES (?, ?, ?, 0, 0)',
        [todayStr, noSalesReceiptId, 'No Sales'], (err) => {
        if (err) {
          console.error('Error creating today\'s record:', err);
        } else {
          console.log(`Created record for ${todayStr} with 0 sales at end of day`);
        }
      });
    } else {
      console.log(`Record for ${todayStr} already exists (sales occurred today)`);
    }
  });
}, {
  timezone: "Asia/Kolkata", // Adjust timezone as needed
  scheduled: true // Ensure it only runs at scheduled times, not on startup
});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, 'pharmacy_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// API Routes
// Authentication
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.query('SELECT * FROM admin_login WHERE username = ? AND password = ?', [username, password], (err, results) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length > 0) {
      const token = jwt.sign(
        { username: username },
        'pharmacy_jwt_secret',
        { expiresIn: '24h' }
      );
      res.json({ token, username });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

// Medicines
app.get('/api/v1/medicines', authenticateToken, (req, res) => {
  db.query('SELECT * FROM stock_available', (err, results) => {
    if (err) {
      console.error('Error fetching medicines:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.post('/api/v1/medicines', authenticateToken, (req, res) => {
  const { medicine, quantity, price_per_strip, tablets_in_a_strip } = req.body;
  const qty = parseInt(quantity);
  const price = parseFloat(price_per_strip);
  const tablets = parseInt(tablets_in_a_strip);

  if (!medicine || medicine.trim() === '' || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0 || isNaN(tablets) || tablets <= 0) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  // Check if medicine already exists
  db.query('SELECT medicine FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) {
      console.error('Error checking medicine existence:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length > 0) {
      return res.status(409).json({ error: 'Medicine already exists' });
    }

    // Insert new medicine
    db.query('INSERT INTO stock_available (medicine, stock, price_per_strip, tablets_in_a_strip, tablets_used_in_current_strip) VALUES (?, ?, ?, ?, 0)',
      [medicine, qty, price, tablets], (err) => {
      if (err) {
        console.error('Error adding medicine:', err);
        return res.status(500).json({ error: 'Failed to add medicine' });
      }
      res.status(201).json({ message: 'Medicine added successfully' });
    });
  });
});

// Stock Management
app.put('/api/v1/medicines/:medicine/stock', authenticateToken, (req, res) => {
  const { medicine } = req.params;
  const { quantity } = req.body;
  const qty = parseInt(quantity);

  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  // Check if medicine exists
  db.query('SELECT stock FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) {
      console.error('Error checking medicine:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // Update stock
    const newStock = results[0].stock + qty;
    db.query('UPDATE stock_available SET stock = ? WHERE medicine = ?', [newStock, medicine], (err) => {
      if (err) {
        console.error('Error updating stock:', err);
        return res.status(500).json({ error: 'Failed to update stock' });
      }
      res.json({ message: 'Stock updated successfully' });
    });
  });
});

// Cart Management (using session for simplicity, but could be moved to database)
app.get('/api/v1/cart', authenticateToken, (req, res) => {
  const purchases = req.session.purchases || [];
  res.json(purchases);
});

app.post('/api/v1/cart/add', authenticateToken, (req, res) => {
  const { medicine, quantity } = req.body;
  const qty = parseInt(quantity);

  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  // Check if medicine exists and get stock info
  db.query('SELECT tablets_in_a_strip, stock, tablets_used_in_current_strip FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) {
      console.error('Error checking medicine:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    if (results[0].stock <= 0) {
      return res.status(400).json({ error: 'Medicine out of stock' });
    }

    const tabletsInStrip = results[0].tablets_in_a_strip;
    const stock = results[0].stock;
    const tabletsUsed = results[0].tablets_used_in_current_strip || 0;
    const totalAvailableTablets = (stock * tabletsInStrip) - tabletsUsed;

    if (qty > totalAvailableTablets) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Initialize purchases array if not exists
    if (!req.session.purchases) {
      req.session.purchases = [];
    }

    // Add to cart
    req.session.purchases.push({ medicine, quantity: qty });
    res.json({ message: 'Added to cart successfully' });
  });
});

app.delete('/api/v1/cart/:index', authenticateToken, (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || !req.session.purchases || index >= req.session.purchases.length) {
    return res.status(400).json({ error: 'Invalid item index' });
  }

  req.session.purchases.splice(index, 1);
  res.json({ message: 'Item removed from cart' });
});

app.delete('/api/v1/cart', authenticateToken, (req, res) => {
  req.session.purchases = [];
  res.json({ message: 'Cart cleared' });
});

// Checkout
app.post('/api/v1/cart/checkout', authenticateToken, (req, res) => {
  if (!req.session.purchases || req.session.purchases.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const purchases = req.session.purchases;
  let errors = [];
  let completed = 0;

  purchases.forEach((purchase, index) => {
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

      newTabletsUsedInCurrentStrip += tabletsToProcess;
      const completeStripsToDeduct = Math.floor(newTabletsUsedInCurrentStrip / tabletsInStrip);
      if (completeStripsToDeduct > 0) {
        newStock -= completeStripsToDeduct;
        newTabletsUsedInCurrentStrip = newTabletsUsedInCurrentStrip % tabletsInStrip;
      }

      db.query('UPDATE stock_available SET stock = ?, tablets_used_in_current_strip = ? WHERE medicine = ?',
        [newStock, newTabletsUsedInCurrentStrip, purchase.medicine], (err) => {
        if (err) {
          errors.push(`Error updating stock for ${purchase.medicine}`);
          return;
        }
        completed++;
        if (completed === purchases.length) {
          if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(', ') });
          }

          // Calculate totals and update transactions
          let processedPurchases = [];
          let calcCompleted = 0;

          purchases.forEach((purchase, idx) => {
            db.query('SELECT price_per_strip, tablets_in_a_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
              if (err) {
                console.error('Error fetching price:', err);
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

              calcCompleted++;
              if (calcCompleted === purchases.length) {
                let grandTotal = processedPurchases.reduce((sum, p) => sum + p.total, 0);
                let discountPercent = 0;
                if (grandTotal > 1000) discountPercent = 15;
                else if (grandTotal > 500) discountPercent = 5;
                else if (grandTotal > 200) discountPercent = 3;
                let discountAmount = grandTotal * discountPercent / 100;
                let discountedTotal = grandTotal - discountAmount;

                const today = new Date();
                const dateStr = today.toISOString().split('T')[0];

                const receiptNumber = generateReceiptNumber();
                db.query('INSERT INTO transactions (receipt_number, date, total_before_discount, total_after_discount) VALUES (?, ?, ?, ?)', [receiptNumber, dateStr, grandTotal, discountedTotal], (insertErr) => {
                    if (insertErr) {
                        return res.status(500).json({ success: false, message: 'Error inserting transaction record.' });
                    }
                    req.session.purchases = [];
                    res.json({
                        message: 'Purchase completed successfully',
                        receipt: {
                          purchases: processedPurchases,
                          grandTotal,
                          discountPercent,
                          discountAmount,
                          discountedTotal
                        }
                      });
                });
              }
            });
          });
        }
      });
    });
  });
});

// Reports
app.get('/api/v1/reports/daily', authenticateToken, (req, res) => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  const query = `
    SELECT
      total_before_discount AS totalBeforeDiscount,
      total_after_discount AS totalAfterDiscount
    FROM transactions
    WHERE date = ?
  `;

  db.query(query, [dateStr], (err, results) => {
    if (err) {
      console.error('Error fetching daily collection:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const data = results[0] || {
      totalBeforeDiscount: 0,
      totalAfterDiscount: 0
    };

    res.json({
      date: dateStr,
      totalBeforeDiscount: Number(data.totalBeforeDiscount) || 0,
      totalAfterDiscount: Number(data.totalAfterDiscount) || 0
    });
  });
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});