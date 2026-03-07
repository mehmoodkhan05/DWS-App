-- Delta Guard Rota Management System - MySQL Database Schema

-- Create database (run this separately if needed)
-- CREATE DATABASE IF NOT EXISTS delta_guard_rota;
-- USE delta_guard_rota;

-- Users/Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'employee') NOT NULL DEFAULT 'employee',
  employee_id VARCHAR(100) NULL,
  department VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  phone VARCHAR(50) NULL,
  hire_date DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shift Patterns table
CREATE TABLE IF NOT EXISTS shift_patterns (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('day', 'night', 'off') NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#3b82f6',
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rotas (Shift Assignments) table
CREATE TABLE IF NOT EXISTS rotas (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  shift_pattern_id VARCHAR(36) NULL,
  notes TEXT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_pattern_id) REFERENCES shift_patterns(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE KEY unique_employee_date (employee_id, date),
  INDEX idx_date (date),
  INDEX idx_employee_id (employee_id),
  INDEX idx_shift_pattern_id (shift_pattern_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  type ENUM('leave', 'shift_swap', 'overtime') NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE NULL,
  reason TEXT NOT NULL,
  admin_notes TEXT NULL,
  approved_by VARCHAR(36) NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_employee_id (employee_id),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  sender_id VARCHAR(36) NOT NULL,
  recipient_id VARCHAR(36) NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_sender_id (sender_id),
  INDEX idx_recipient_id (recipient_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Group Messages table
CREATE TABLE IF NOT EXISTS group_messages (
  id VARCHAR(36) PRIMARY KEY,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  target_role ENUM('admin', 'manager', 'employee') NULL,
  target_department VARCHAR(255) NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_is_pinned (is_pinned),
  INDEX idx_created_at (created_at),
  INDEX idx_target_role (target_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log table
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
  category ENUM('authentication', 'data_modification', 'system_access', 'security', 'configuration') NOT NULL DEFAULT 'system_access',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_severity (severity),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123 - change this in production!)
-- Password hash for 'admin123' using bcrypt (10 rounds)
-- To generate a new hash, use: node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(h => console.log(h));"
-- Note: This is a placeholder. You should create the admin user through the API or update this hash.
-- INSERT INTO profiles (id, full_name, email, password_hash, role, is_active) 
-- VALUES (
--   UUID(),
--   'Admin User',
--   'admin@deltaguard.com',
--   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- admin123
--   'admin',
--   TRUE
-- ) ON DUPLICATE KEY UPDATE email=email;

-- Insert default shift patterns
INSERT INTO shift_patterns (id, name, type, start_time, end_time, color, description) VALUES
(UUID(), 'Day Shift', 'day', '08:00:00', '16:00:00', '#10b981', 'Standard day shift'),
(UUID(), 'Night Shift', 'night', '20:00:00', '08:00:00', '#3b82f6', 'Standard night shift'),
(UUID(), 'Off Day', 'off', NULL, NULL, '#6b7280', 'Rest day')
ON DUPLICATE KEY UPDATE name=name;
