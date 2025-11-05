-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 05, 2025 at 11:09 AM
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
-- Table structure for table `stock_available`
--

CREATE TABLE `stock_available` (
  `medicine` varchar(25) NOT NULL,
  `stock` int(11) NOT NULL,
  `price_per_strip` int(11) DEFAULT NULL,
  `tablets_in_a_strip` int(11) DEFAULT NULL,
  `tablets_used_in_current_strip` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_available`
--

INSERT INTO `stock_available` (`medicine`, `stock`, `price_per_strip`, `tablets_in_a_strip`, `tablets_used_in_current_strip`) VALUES
('Paracetamol', 32, 35, 10, 2),
('Ibuprofen', 23, 50, 10, 0),
('Amoxicillin', 54, 95, 6, 0),
('Metformin', 100, 40, 10, 0),
('Atorvastatin', 74, 120, 10, 0),
('Omeprazole', 86, 65, 15, 0),
('Cetirizine', 150, 25, 10, 0),
('Azithromycin', 40, 110, 6, 0),
('Losartan', 55, 85, 10, 0),
('Salbutamol', 29, 70, 10, 0),
('Amlodipine', 65, 60, 10, 0),
('Ciprofloxacin', 44, 90, 10, 0),
('Doxycycline', 70, 80, 8, 0),
('Hydrochlorothiazide', 80, 55, 10, 0),
('Clopidogrel', 50, 140, 10, 0),
('Levothyroxine', 95, 35, 15, 0),
('Prednisolone', 40, 75, 10, 0),
('Lisinopril', 60, 100, 10, 0),
('Glibenclamide', 70, 45, 10, 0),
('Pantoprazole', 84, 70, 15, 0),
('Diclofenac', 100, 40, 10, 0),
('Furosemide', 75, 50, 10, 0),
('Insulin Glargine', 16, 300, 1, 0),
('Ranitidine', 90, 55, 10, 0),
('Simvastatin', 50, 110, 10, 0),
('Sertraline', 40, 160, 10, 0),
('Tramadol', 23, 130, 10, 0),
('Fluconazole', 55, 95, 4, 0),
('Montelukast', 60, 125, 10, 0),
('Domperidone', 95, 65, 10, 0),
('Clarithromycin', 45, 120, 6, 0),
('Erythromycin', 30, 85, 8, 0),
('Cefixime', 70, 150, 10, 0),
('Naproxen', 80, 75, 10, 0),
('Carbamazepine', 40, 140, 10, 0),
('Warfarin', 50, 90, 10, 0),
('Aspirin', 120, 30, 10, 0),
('Vitamin D3', 148, 180, 4, 0),
('Iron Supplement', 98, 70, 15, 0),
('Calcium Carbonate', 89, 95, 10, 0),
('Brivup(50 mg)', 65, 190, 10, 0),
('Brivup(25 mg)', 51, 34, 7, 0),
('Supradyn', 48, 72, 15, 0);

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` int(11) NOT NULL,
  `date` date NOT NULL,
  `total_before_discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_after_discount` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`id`, `date`, `total_before_discount`, `total_after_discount`) VALUES
(1, '2025-11-05', 2850.00, 2737.00);

--
-- Indexes for dumped tables
--

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
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
