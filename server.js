const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const PDFDocument = require('pdfkit');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const port = 3000;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout');

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
    res.redirect('/menu');
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
      req.session.formData = {}; // Clear form data on login
      res.redirect('/menu');
    } else {
      res.render('login', { error: 'Incorrect username or password.' });
    }
  });
});

app.get('/menu', (req, res) => {
  if (req.session.loggedin) {
    // Fetch from stock_available table
    db.query('SELECT * FROM stock_available', (err, results) => {
      if (err) {
        console.error('Error fetching stock:', err);
        res.render('menu', { username: req.session.username, medicines: [], error: null, success: null });
      } else {
        res.render('menu', {
          username: req.session.username,
          medicines: results,
          error: req.query.error || null,
          success: req.query.success || null
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
        res.render('view_dashboard', { username: req.session.username, medicines: [], purchases: req.session.purchases || [], error: null, success: null, cartError: null, formData: req.session.formData || {}, clearLocalStorage: clearLocalStorage });
      } else {
        res.render('view_dashboard', {
          username: req.session.username,
          medicines: results,
          purchases: req.session.purchases || [],
          error: req.query.error || null,
          success: req.query.success || null,
          cartError: req.query.cartError || null,
          formData: req.session.formData || {},
          clearForm: req.query.success === 'Added to cart',
          clearLocalStorage: clearLocalStorage
        });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/add-stock', (req, res) => {
  if (req.session.loggedin) {
    // Fetch from stock_available table
    db.query('SELECT * FROM stock_available', (err, results) => {
      if (err) {
        console.error('Error fetching stock:', err);
        res.render('add_stock', { username: req.session.username, medicines: [] });
      } else {
        res.render('add_stock', { username: req.session.username, medicines: results });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/add-medicine', (req, res) => {
  if (req.session.loggedin) {
    res.render('add_medicine', { username: req.session.username });
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
    return res.redirect('/menu?error=Invalid quantity');
  }
  // Store form data in session for retention
  req.session.formData = { medicine, quantity };
  // Check if medicine exists and get tablets per strip and stock (but don't deduct stock yet)
  db.query('SELECT tablets_in_a_strip, stock, tablets_used_in_current_strip FROM stock_available WHERE medicine = ?', [medicine], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      return res.redirect('/menu?error=Medicine not found');
    }
    if (results[0].stock <= 0) {
      return res.redirect('/menu?cartError=Medicine out of stock');
    }
    const tabletsInStrip = results[0].tablets_in_a_strip;
    const stock = results[0].stock;
    const tabletsUsed = results[0].tablets_used_in_current_strip || 0;
    const totalAvailableTablets = (stock * tabletsInStrip) - tabletsUsed;
    if (qty > totalAvailableTablets) {
      return res.redirect('/menu?cartError=Entered quantity more than available quantity');
    }
    // Initialize purchases array if not exists
    if (!req.session.purchases) {
      req.session.purchases = [];
    }
    // Add purchase to session (without deducting stock yet)
    req.session.purchases.push({ medicine, quantity: qty });
    req.session.formData = {}; // Clear form data after successful add to cart
    res.redirect('/view-dashboard?success=Added to cart');
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
            return res.redirect('/view-dashboard?error=' + encodeURIComponent(errors.join(', ')));
          }
          req.session.formData = {}; // Clear form data after successful purchase
          req.session.receiptPurchases = req.session.purchases.slice(); // Store for receipts

          // Insert transaction record for daily collection
          const purchases = req.session.receiptPurchases;
          if (purchases.length > 0) {
            let processedPurchases = [];
            let calcCompleted = 0;

            purchases.forEach((purchase, index) => {
              db.query('SELECT price_per_strip, tablets_in_a_strip FROM stock_available WHERE medicine = ?', [purchase.medicine], (err, results) => {
                if (err) {
                  console.error('Error fetching price for transaction:', err);
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

                  // Update or insert daily collection record
                  const today = new Date();
                  const dateStr = today.toISOString().split('T')[0];

                  // First, check if a record for today exists
                  db.query('SELECT * FROM transactions WHERE date = ?', [dateStr], (err, results) => {
                    if (err) {
                      console.error('Error checking daily collection:', err);
                      return res.redirect('/receipts');
                    }

                    if (results.length > 0) {
                      // Update existing record
                      const currentBefore = parseFloat(results[0].total_before_discount) || 0;
                      const currentAfter = parseFloat(results[0].total_after_discount) || 0;

                      db.query('UPDATE transactions SET total_before_discount = ?, total_after_discount = ? WHERE date = ?',
                        [currentBefore + grandTotal, currentAfter + discountedTotal, dateStr], (err) => {
                        if (err) {
                          console.error('Error updating daily collection:', err);
                        }
                        // Continue to receipts regardless
                        res.redirect('/receipts');
                      });
                    } else {
                      // Insert new record
                      db.query('INSERT INTO transactions (date, total_before_discount, total_after_discount) VALUES (?, ?, ?)',
                        [dateStr, grandTotal, discountedTotal], (err) => {
                        if (err) {
                          console.error('Error inserting daily collection:', err);
                        }
                        // Continue to receipts regardless
                        res.redirect('/receipts');
                      });
                    }
                  });
                }
              });
            });
          } else {
            res.redirect('/receipts');
          }
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
      res.redirect('/menu');
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
    // Insert new medicine with all details
    db.query('INSERT INTO stock_available (medicine, stock, price_per_strip, tablets_in_a_strip, tablets_used_in_current_strip) VALUES (?, ?, ?, ?, 0)', [medicine, qty, price, tablets], (err) => {
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
            discountedTotal: discountedTotal
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
      discountedTotal: 0
    });
  }
});

app.post('/generate-receipts', (req, res) => {
  if (!req.session.loggedin || !req.session.receiptPurchases) {
    return res.redirect('/');
  }
  const { patientName } = req.body;
  req.session.patientName = patientName;

  res.redirect('/receipts');
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
    res.setHeader('Content-Disposition', 'attachment; filename=receipt.pdf');
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
    const receiptNumber = `RCP-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
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

app.get('/daily-collection', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }

  // Get today's date in YYYY-MM-DD format for query
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  // Format date for display as DD MM YYYY
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const formattedDate = `${day}-${month}-${year}`;

  // Query to get daily collection summary
  // Sum total_before_discount and total_after_discount for today
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
      return res.render('daily_collection', {
        date: formattedDate,
        totalBeforeDiscount: 0,
        totalAfterDiscount: 0
      });
    }

    const data = results[0] || {
      totalBeforeDiscount: 0,
      totalAfterDiscount: 0
    };

    res.render('daily_collection', {
      date: formattedDate,
      totalBeforeDiscount: Number(data.totalBeforeDiscount) || 0,
      totalAfterDiscount: Number(data.totalAfterDiscount) || 0
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