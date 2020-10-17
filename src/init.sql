CREATE DATABASE IF NOT EXISTS `scraped_results`;

USE `scraped_results`;

CREATE TABLE IF NOT EXISTS `scraped_results_table` (
  `URL` varchar(100) NOT NULL PRIMARY KEY,
  `REFERENCE_COUNT` int unsigned NOT NULL,
  `PARAMETERS` varchar(100) NOT NULL
);
