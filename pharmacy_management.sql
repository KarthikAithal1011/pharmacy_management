-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 03, 2025 at 05:00 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pharmacy_management`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_login`
--

CREATE TABLE `admin_login` (
  `username` varchar(10) NOT NULL,
  `password` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_login`
--

INSERT INTO `admin_login` (`username`, `password`) VALUES
('admin', 'adminpassword');

-- --------------------------------------------------------

--
-- Table structure for table `receipts`
--

CREATE TABLE `receipts` (
  `id` int(11) NOT NULL,
  `receipt_id` varchar(255) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `total_after_discount` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `receipts`
--

INSERT INTO `receipts` (`id`, `receipt_id`, `customer_name`, `date`, `total_after_discount`) VALUES
(1, 'RCP-20251201-163', 'Customer123', '2025-12-01', 42.00),
(2, 'RCP-20251201-455', 'Walk-in Customer', '2025-12-01', 42.00),
(3, 'RCP-20251201-470', 'Walk-in Customer', '2025-12-01', 42.00),
(4, 'RCP-20251201-325', 'Walk-in Customer', '2025-12-01', 55.00),
(5, 'RCP-20251201-317', 'Walk-in Customer', '2025-12-01', 8.40),
(6, 'RCP-20251202-398', 'Walk-in Customer', '2025-12-02', 42.00),
(7, 'RCP-20251202-351', 'Walk-in Customer', '2025-12-02', 203.70),
(8, 'RCP-20251202-035', 'Walk-in Customer', '2025-12-02', 28.00),
(9, 'RCP-20251202-752', 'Walk-in Customer', '2025-12-02', 110.00),
(10, 'RCP-20251202-249', 'Walk-in Customer', '2025-12-02', 110.00),
(11, 'RCP-20251202-264', 'Walk-in Customer', '2025-12-02', 194.00),
(12, 'RCP-20251202-965', 'Walk-in Customer', '2025-12-02', 90.00),
(13, 'RCP-20251202-942', 'Walk-in Customer', '2025-12-02', 42.00),
(14, 'RCP-20251202-238', 'Walk-in Customer', '2025-12-02', 42.00),
(15, 'RCP-20251202-285', 'Walk-in Customer', '2025-12-02', 42.00),
(16, 'RCP-20251202-787', 'Walk-in Customer', '2025-12-02', 42.00),
(17, 'RCP-20251202-972', 'Walk-in Customer', '2025-12-02', 42.00),
(18, 'RCP-20251202-058', 'Walk-in Customer', '2025-12-02', 42.00),
(19, 'RCP-20251202-083', 'Walk-in Customer', '2025-12-02', 42.00);

-- --------------------------------------------------------

--
-- Table structure for table `stock_available`
--

CREATE TABLE `stock_available` (
  `medicine` varchar(50) DEFAULT NULL,
  `stock` int(11) NOT NULL,
  `price_per_strip` int(11) DEFAULT NULL,
  `tablets_in_a_strip` int(11) DEFAULT NULL,
  `tablets_used_in_current_strip` int(11) DEFAULT 0,
  `expiry_date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_available`
--

INSERT INTO `stock_available` (`medicine`, `stock`, `price_per_strip`, `tablets_in_a_strip`, `tablets_used_in_current_strip`, `expiry_date`) VALUES
('Metformin 500mg', 132, 42, 10, 0, '2027-02-14'),
('Aspirin 75mg', 280, 28, 14, 0, '2026-11-09'),
('Pantoprazole 40mg', 150, 55, 10, 0, '2027-06-22'),
('Ranitidine 150mg', 130, 38, 10, 0, '2026-03-30'),
('Doxycycline 100mg', 90, 110, 8, 0, '2026-10-04'),
('Vitamin C 500mg', 248, 60, 15, 0, '2028-08-29'),
('Iron Folic Acid', 220, 75, 10, 0, '2027-01-17'),
('Calcium + Vitamin D3', 140, 95, 15, 0, '2026-12-03'),
('Levocetirizine 5mg', 210, 22, 10, 0, '2027-07-11'),
('Montelukast 10mg', 98, 130, 10, 5, '2028-05-19'),
('Atorvastatin 10mg', 160, 150, 10, 0, '2027-04-16'),
('Amlodipine 5mg', 180, 45, 15, 0, '2026-09-27'),
('Losartan 50mg', 150, 85, 10, 0, '2028-01-02'),
('Telmisartan 40mg', 140, 95, 10, 0, '2027-11-23'),
('Metoprolol 50mg', 108, 88, 10, 0, '2026-06-08'),
('Clopidogrel 75mg', 75, 165, 14, 0, '2028-02-15'),
('Hydroxychloroquine 200mg', 60, 120, 10, 0, '2027-10-25'),
('Thyroxine 50mcg', 200, 30, 15, 0, '2028-05-07'),
('Thyroxine 100mcg', 190, 52, 15, 0, '2027-09-13'),
('Omeprazole 20mg', 180, 48, 10, 0, '2028-03-21'),
('Fexofenadine 120mg', 170, 140, 10, 0, '2026-12-17'),
('Sodium Bicarbonate 500mg', 130, 20, 15, 0, '2027-05-05'),
('Loratadine 10mg', 210, 24, 10, 0, '2028-02-09'),
('Multivitamin Tablets', 240, 160, 10, 0, '2027-04-04'),
('Cough Syrup Tablets', 90, 70, 10, 0, '2026-08-28'),
('Antacid Chewable', 200, 32, 12, 0, '2027-11-12'),
('ORS Tablets', 245, 18, 10, 0, '2026-09-01'),
('Zinc 50mg', 170, 55, 10, 0, '2026-06-14'),
('Probiotic Capsules', 130, 140, 8, 0, '2027-07-07'),
('Azithromycin 500mg', 60, 150, 3, 0, '2026-07-16'),
('Cefixime 200mg', 80, 180, 10, 0, '2028-01-30'),
('Cetirizine + Pseudoephedrine', 90, 85, 10, 0, '2027-08-08'),
('B Complex', 220, 48, 10, 0, '2028-02-19'),
('Melatonin 3mg', 75, 210, 10, 0, '2027-10-22'),
('Ginkgo Biloba', 13, 260, 10, 0, '2026-09-10'),
('Folic Acid 5mg', 200, 30, 10, 0, '2027-06-11'),
('Lisinopril 10mg', 160, 90, 10, 0, '2028-01-26'),
('Prednisolone 10mg', 120, 70, 10, 0, '2027-03-02'),
('Diclofenac 50mg', 180, 40, 10, 0, '2028-04-30'),
('Tramadol 50mg', 50, 160, 10, 0, '2027-12-03'),
('Brivup 50mg', 50, 80, 15, 0, '2025-12-19');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` int(11) NOT NULL,
  `receipt_number` varchar(255) NOT NULL DEFAULT '',
  `date` date NOT NULL,
  `total_before_discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_after_discount` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`id`, `receipt_number`, `date`, `total_before_discount`, `total_after_discount`) VALUES
(1, '', '2025-11-05', 2850.00, 2737.00),
(2, '', '2025-11-06', 1675.00, 1450.00),
(3, '', '2025-11-07', 5760.00, 4896.00),
(4, '', '2025-11-08', 70.00, 70.00),
(5, '', '2025-11-10', 248.00, 248.00),
(6, '', '2025-11-12', 900.00, 855.00),
(7, '', '2025-11-14', 1455.00, 1429.65),
(8, '', '2025-11-19', 785.00, 785.00),
(9, '', '2025-11-21', 10880.00, 9339.00),
(10, '', '2025-11-24', 260.00, 260.00),
(11, '', '2025-12-01', 1721.40, 1713.00),
(12, '', '2025-12-02', 2091.00, 2084.70);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `receipts`
--
ALTER TABLE `receipts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `date` (`date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `receipts`
--
ALTER TABLE `receipts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
