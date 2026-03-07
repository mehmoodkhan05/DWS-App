import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin, requireManager } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

// Get all profiles (all authenticated users, but filtered by role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isAdminOrManager = req.user.role === 'admin' || req.user.role === 'manager';
    
    if (isAdminOrManager) {
      // Admin and manager can see all profiles with full details
      const [profiles] = await pool.execute(
        'SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active, created_at, updated_at FROM profiles ORDER BY created_at DESC'
      );
      res.json(profiles);
    } else {
      // Employees can only see basic info of active employees (for shift assignments, reports, etc.)
      const [profiles] = await pool.execute(
        `SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active, created_at, updated_at 
         FROM profiles 
         WHERE is_active = true 
         ORDER BY created_at DESC`
      );
      res.json(profiles);
    }
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Get single profile
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Users can only view their own profile unless they're admin/manager
    if (req.user.id !== req.params.id && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [profiles] = await pool.execute(
      'SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active, created_at, updated_at FROM profiles WHERE id = ?',
      [req.params.id]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profiles[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Create profile (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').trim().notEmpty(),
  body('role').isIn(['admin', 'manager', 'employee'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, full_name, role, employee_id, department, avatar_url, phone, hire_date, is_active = true } = req.body;

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

    // Auto-generate employee_id for employees if not provided
    let finalEmployeeId = employee_id;
    if (role === 'employee' && !finalEmployeeId) {
      finalEmployeeId = await generateEmployeeId();
    }

    // Create profile
    await pool.execute(
      `INSERT INTO profiles (id, full_name, email, password_hash, role, employee_id, department, avatar_url, phone, hire_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, full_name, email, passwordHash, role, finalEmployeeId || null, department || null, avatar_url || null, phone || null, hire_date || null, is_active]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'profile_created', 'profiles', `Created profile: ${email}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [newProfile] = await pool.execute(
      'SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active, created_at, updated_at FROM profiles WHERE id = ?',
      [userId]
    );

    res.status(201).json(newProfile[0]);
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Upload avatar
router.post('/:id/avatar', authenticateToken, [
  body('image').notEmpty().withMessage('Image data is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image format. Use base64 data URL.' });
    }

    const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1] === 'png' ? 'png' : 'jpg';
    const buffer = Buffer.from(match[2], 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Max 5MB.' });
    }

    const filename = `${req.params.id}-${Date.now()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;

    await pool.execute('UPDATE profiles SET avatar_url = ? WHERE id = ?', [avatarUrl, req.params.id]);
    await logAuditEvent(req.user.id, 'avatar_updated', 'profiles', `Avatar updated for: ${req.params.id}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      'SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active, created_at, updated_at FROM profiles WHERE id = ?',
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Remove avatar
router.delete('/:id/avatar', authenticateToken, async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [profiles] = await pool.execute('SELECT avatar_url FROM profiles WHERE id = ?', [req.params.id]);
    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const avatarUrl = profiles[0].avatar_url;
    if (avatarUrl && avatarUrl.startsWith('/uploads/avatars/')) {
      const filename = path.basename(avatarUrl);
      const filepath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    await pool.execute('UPDATE profiles SET avatar_url = NULL WHERE id = ?', [req.params.id]);
    await logAuditEvent(req.user.id, 'avatar_removed', 'profiles', `Avatar removed for: ${req.params.id}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      'SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active, created_at, updated_at FROM profiles WHERE id = ?',
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Avatar remove error:', error);
    res.status(500).json({ error: 'Failed to remove avatar' });
  }
});

// Update profile
router.put('/:id', authenticateToken, [
  body('email').optional().isEmail().normalizeEmail(),
  body('full_name').optional().trim().notEmpty(),
  body('role').optional().isIn(['admin', 'manager', 'employee'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Users can only update their own profile unless they're admin
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only admin can change role
    const updates = {};
    const allowedFields = ['full_name', 'email', 'employee_id', 'department', 'avatar_url', 'phone', 'hire_date', 'is_active'];
    
    if (req.user.role === 'admin') {
      allowedFields.push('role');
    }

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // Convert empty strings to null for optional fields
        const value = req.body[field];
        if (value === '' && ['employee_id', 'department', 'avatar_url', 'phone', 'hire_date'].includes(field)) {
          updates[field] = null;
        } else {
          updates[field] = value;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Note: updated_at is automatically updated by MySQL ON UPDATE CURRENT_TIMESTAMP

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE profiles SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'profile_updated', 'profiles', `Updated profile: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      'SELECT id, full_name, email, role, employee_id, department, avatar_url, phone, hire_date, is_active, created_at, updated_at FROM profiles WHERE id = ?',
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Failed to update profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete profile (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await pool.execute('DELETE FROM profiles WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'profile_deleted', 'profiles', `Deleted profile: ${req.params.id}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// Update password (admin only)
router.patch('/:id/password', authenticateToken, requireAdmin, [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { password } = req.body;

    // Check if profile exists
    const [profiles] = await pool.execute(
      'SELECT id, email FROM profiles WHERE id = ?',
      [req.params.id]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password
    await pool.execute(
      'UPDATE profiles SET password_hash = ? WHERE id = ?',
      [passwordHash, req.params.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'password_updated', 'profiles', `Password updated for: ${profiles[0].email}`, 'high', 'security', req.ip, req.get('user-agent'));

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Toggle active status (admin/manager only)
router.patch('/:id/toggle-active', authenticateToken, requireManager, async (req, res) => {
  try {
    const [profiles] = await pool.execute(
      'SELECT is_active FROM profiles WHERE id = ?',
      [req.params.id]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const newStatus = !profiles[0].is_active;

    await pool.execute(
      'UPDATE profiles SET is_active = ? WHERE id = ?',
      [newStatus, req.params.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'profile_status_toggled', 'profiles', `Toggled status to ${newStatus} for: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: `Profile ${newStatus ? 'activated' : 'deactivated'} successfully`, is_active: newStatus });
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ error: 'Failed to toggle active status' });
  }
});

export default router;
