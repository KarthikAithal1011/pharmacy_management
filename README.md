Pharmacy Management System

This is a web-based application for managing a pharmacy's inventory and sales. It provides a simple interface for administrators to manage stock, handle billing, and track daily sales.

Features:
Admin Authentication: Secure login for administrators.

Stock Management:
  - Add new medicines to the inventory.
  - Update stock levels for existing medicines.
  - View a complete list of available stock.
- Billing and Sales:
  - A simple-to-use interface for selling medicines.
  - Shopping cart functionality to handle multiple items.
  - Automatic stock deduction upon sale.
- Receipt Generation:
  - Automatically generates a detailed receipt for each transaction.
  - Option to download the receipt as a PDF.
- Reporting:
  - Tracks and displays the total sales collection for the day.
- 


Technologies Used:
- Backend:Node.js, Express.js
- Frontend:EJS (Embedded JavaScript templates), HTML, CSS, JavaScript
- Database: MySQL
- Other Key Packages:
  - `express-session` for user session management.
  - `pdfkit` for generating PDF receipts.
  - `node-cron` for scheduling tasks.


Database Setup:
To import the .sql file present in this repository, first open XAMPP MySQL in your system, create a new database called pharmacy_management. Click the IMPORT option(next to the SQL option at the top), and import this file.
