CREATE TABLE receipts (
  id INT(11) NOT NULL AUTO_INCREMENT,
  receipt_id VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  total_after_discount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
