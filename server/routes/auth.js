import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Helper function to generate automatic employee ID
async function generateEmployeeId() {
  try {
    // Find the highest existing employee_id that matches the pattern EMP###
    const [results] = await pool.execute(
      `SELECT employee_id FROM profiles 
       WHERE employee_id IS NOT NULL 
       AND employee_id REGEXP '^EMP[0-9]+$'
       ORDER BY CAST(SUBSTRING(employee_id, 4) AS UNSIGNED) DESC 
       LIMIT 1`
    );

    if (results.length === 0) {
      // No existing employee IDs, start with EMP001
      return 'EMP001';
    }

    // Extract the number from the highest employee_id (e.g., "EMP123" -> 123)
    const lastNumber = parseInt(results[0].employee_id.substring(3), 10);
    const nextNumber = lastNumber + 1;
    
    // Format as EMP### with zero padding (e.g., EMP001, EMP002, ..., EMP123)
    return `EMP${String(nextNumber).padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating employee ID:', error);
    // Fallback: use timestamp-based ID if query fails
    return `EMP${Date.now().toString().slice(-6)}`;
  }
}

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').trim().notEmpty(),
  body('role').optional().isIn(['admin', 'manager', 'employee'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, full_name, role = 'employee' } = req.body;

    // Check if user exists
    const [existing] = await pool.execute(
      'SELECT id FROM profiles WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Auto-generate employee_id for employees if role is employee
    let employeeId = null;
    if (role === 'employee') {
      employeeId = await generateEmployeeId();
    }

    // Create user
    await pool.execute(
      `INSERT INTO profiles (id, full_name, email, password_hash, role, employee_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, full_name, email, passwordHash, role, employeeId, true]
    );

    // Generate token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    // Log audit event
    await logAuditEvent(userId, 'user_registered', 'profiles', `New ${role} registered: ${email}`, 'low', 'authentication', req.ip, req.get('user-agent'));

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        email,
        full_name,
        role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const [users] = await pool.execute(
      'SELECT id, full_name, email, password_hash, role, employee_id, department, avatar_url, phone, hire_date, is_active FROM profiles WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Log audit event
    await logAuditEvent(user.id, 'user_login', 'authentication', `User logged in: ${email}`, 'low', 'authentication', req.ip, req.get('user-agent'));

    // Remove password hash from response
    delete user.password_hash;

    res.json({
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active FROM profiles WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
