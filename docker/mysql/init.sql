-- Taxi.Rio: Script de inicializacao do banco de dados relacional (MySQL)
CREATE DATABASE IF NOT EXISTS taxirio;
USE taxirio;

-- Tabela de Corridas (Fonte da Verdade)
CREATE TABLE IF NOT EXISTS corridas (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  passenger_id VARCHAR(36) NOT NULL,
  driver_id VARCHAR(36) NULL,
  status ENUM('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  origin_latitude DECIMAL(10, 8) NOT NULL,
  origin_longitude DECIMAL(11, 8) NOT NULL,
  origin_address VARCHAR(255) NULL,
  destination_latitude DECIMAL(10, 8) NOT NULL,
  destination_longitude DECIMAL(11, 8) NOT NULL,
  destination_address VARCHAR(255) NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_passenger (passenger_id),
  INDEX idx_driver (driver_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela para garantia de idempotencia no POST /corridas
CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key VARCHAR(128) NOT NULL PRIMARY KEY,
  resource_id VARCHAR(36) NULL,
  status_code INT NOT NULL,
  response_body JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
