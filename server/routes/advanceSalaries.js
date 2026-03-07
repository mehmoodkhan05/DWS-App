import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin, requireManager } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all advance salary requests
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isAdminOrManager = req.user.role === 'admin' || req.user.role === 'manager';
    
    let query = `
      SELECT a.*, 
             p.full_name as employee_name,
             p.email as employee_email,
             p.employee_id,
             approver.full_name as approved_by_name
      FROM advance_salaries a
      LEFT JOIN profiles p ON a.employee_id = p.id
      LEFT JOIN profiles approver ON a.approved_by = approver.id
    `;
    let params = [];

    if (isAdminOrManager) {
      // Admin/Manager can see all requests
      query += ' ORDER BY a.created_at DESC';
    } else {
      // Employees can only see their own requests
      query += ' WHERE a.employee_id = ? ORDER BY a.created_at DESC';
      params.push(req.user.id);
    }

    const [advances] = await pool.execute(query, params);
    res.json(advances);
  } catch (error) {
    console.error('Get advance salaries error:', error);
    res.status(500).json({ error: 'Failed to fetch advance salary requests' });
  }
});

// Get single advance salary request
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const isAdminOrManager = req.user.role === 'admin' || req.user.role === 'manager';
    
    let query = `
      SELECT a.*, 
             p.full_name as employee_name,
             p.email as employee_email,
             p.employee_id,
             approver.full_name as approved_by_name
      FROM advance_salaries a
      LEFT JOIN profiles p ON a.employee_id = p.id
      LEFT JOIN profiles approver ON a.approved_by = approver.id
      WHERE a.id = ?
    `;
    let params = [req.params.id];

    if (!isAdminOrManager) {
      query += ' AND a.employee_id = ?';
      params.push(req.user.id);
    }

    const [advances] = await pool.execute(query, params);

    if (advances.length === 0) {
      return res.status(404).json({ error: 'Advance salary request not found' });
    }

    res.json(advances[0]);
  } catch (error) {
    console.error('Get advance salary error:', error);
    res.status(500).json({ error: 'Failed to fetch advance salary request' });
  }
});

// Create advance salary request (users can create their own)
router.post('/', authenticateToken, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('request_date').isISO8601().toDate().withMessage('Valid request date is required'),
  body('employee_id').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, reason, request_date, employee_id } = req.body;

    // Determine employee_id - admin can set it, others use their own
    const finalEmployeeId = req.user.role === 'admin' && employee_id 
      ? employee_id 
      : req.user.id;

    // Verify employee exists
    const [employees] = await pool.execute(
      'SELECT id FROM profiles WHERE id = ?',
      [finalEmployeeId]
    );

    if (employees.length === 0) {
      return res.status(400).json({ error: 'Employee not found' });
    }

    // Check if employee has pending requests
    const [pending] = await pool.execute(
      'SELECT id FROM advance_salaries WHERE employee_id = ? AND status = "pending"',
      [finalEmployeeId]
    );

    if (pending.length > 0) {
      return res.status(400).json({ 
        error: 'You already have a pending advance salary request. Please wait for it to be processed.' 
      });
    }

    const advanceId = uuidv4();

    await pool.execute(
      `INSERT INTO advance_salaries (id, employee_id, amount, reason, request_date, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [advanceId, finalEmployeeId, amount, reason, request_date]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'advance_salary_requested', 'advance_salaries', `Requested advance: ${amount}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [newAdvance] = await pool.execute(
      `SELECT a.*, 
              p.full_name as employee_name,
              p.email as employee_email,
              p.employee_id,
              approver.full_name as approved_by_name
       FROM advance_salaries a
       LEFT JOIN profiles p ON a.employee_id = p.id
       LEFT JOIN profiles approver ON a.approved_by = approver.id
       WHERE a.id = ?`,
      [advanceId]
    );

    res.status(201).json(newAdvance[0]);
  } catch (error) {
    console.error('Create advance salary error:', error);
    res.status(500).json({ error: 'Failed to create advance salary request' });
  }
});

// Update advance salary request (users can update their own pending requests, admin can update any)
router.put('/:id', authenticateToken, [
  body('amount').optional().isFloat({ min: 0.01 }),
  body('reason').optional().trim().notEmpty(),
  body('request_date').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get existing request
    const [existing] = await pool.execute(
      'SELECT * FROM advance_salaries WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Advance salary request not found' });
    }

    const advance = existing[0];
    const isAdmin = req.user.role === 'admin';
    const isOwner = advance.employee_id === req.user.id;
    const isPending = advance.status === 'pending';

    if (!isAdmin && (!isOwner || !isPending)) {
      return res.status(403).json({ 
        error: 'You can only update your own pending requests' 
      });
    }

    const updates = {};
    const allowedFields = ['amount', 'reason', 'request_date'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE advance_salaries SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'advance_salary_updated', 'advance_salaries', `Updated advance: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT a.*, 
              p.full_name as employee_name,
              p.email as employee_email,
              p.employee_id,
              approver.full_name as approved_by_name
       FROM advance_salaries a
       LEFT JOIN profiles p ON a.employee_id = p.id
       LEFT JOIN profiles approver ON a.approved_by = approver.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update advance salary error:', error);
    res.status(500).json({ error: 'Failed to update advance salary request' });
  }
});

// Approve/Reject/Pay advance salary (admin/manager only)
router.patch('/:id/status', authenticateToken, requireManager, [
  body('status').isIn(['approved', 'rejected', 'paid']).withMessage('Status must be approved, rejected, or paid'),
  body('rejection_reason').optional().trim(),
  body('admin_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, rejection_reason, admin_notes } = req.body;

    const [existing] = await pool.execute(
      'SELECT * FROM advance_salaries WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Advance salary request not found' });
    }

    const updates = {
      status,
      approved_by: req.user.id
    };

    if (status === 'approved' || status === 'paid') {
      updates.approved_at = new Date();
      updates.rejection_reason = null;
    }

    if (status === 'paid') {
      updates.paid_at = new Date();
    }

    if (status === 'rejected') {
      updates.approved_at = new Date();
      updates.rejection_reason = rejection_reason || null;
    }

    if (admin_notes !== undefined) {
      updates.admin_notes = admin_notes || null;
    }

    await pool.execute(
      `UPDATE advance_salaries 
       SET status = ?, approved_by = ?, approved_at = ?, paid_at = ?, rejection_reason = ?, admin_notes = ?
       WHERE id = ?`,
      [updates.status, updates.approved_by, updates.approved_at, updates.paid_at || null, updates.rejection_reason, updates.admin_notes, req.params.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'advance_salary_status_changed', 'advance_salaries', `${status} advance: ${req.params.id}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT a.*, 
              p.full_name as employee_name,
              p.email as employee_email,
              p.employee_id,
              approver.full_name as approved_by_name
       FROM advance_salaries a
       LEFT JOIN profiles p ON a.employee_id = p.id
       LEFT JOIN profiles approver ON a.approved_by = approver.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update advance salary status error:', error);
    res.status(500).json({ error: 'Failed to update advance salary status' });
  }
});

// Delete advance salary request (users can delete their own pending requests, admin can delete any)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM advance_salaries WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Advance salary request not found' });
    }

    const advance = existing[0];
    const isAdmin = req.user.role === 'admin';
    const isOwner = advance.employee_id === req.user.id;
    const isPending = advance.status === 'pending';

    if (!isAdmin && (!isOwner || !isPending)) {
      return res.status(403).json({ 
        error: 'You can only delete your own pending requests' 
      });
    }

    await pool.execute('DELETE FROM advance_salaries WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'advance_salary_deleted', 'advance_salaries', `Deleted advance: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Advance salary request deleted successfully' });
  } catch (error) {
    console.error('Delete advance salary error:', error);
    res.status(500).json({ error: 'Failed to delete advance salary request' });
  }
});

export default router;
