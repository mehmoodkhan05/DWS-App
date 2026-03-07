import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all announcements
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Admins can see all announcements regardless of target_role
    const isAdmin = req.user.role === 'admin';
    
    let query = `
      SELECT a.*, p.full_name as author_name
      FROM announcements a
      LEFT JOIN profiles p ON a.author_id = p.id
      WHERE 1=1
    `;

    let params = [];

    // Filter by role: NULL means "all roles", otherwise must match user's role
    // Admins see all announcements, managers and employees are filtered
    if (!isAdmin) {
      query += ' AND (a.target_role IS NULL OR a.target_role = ?)';
      params.push(req.user.role);
    }

    // Department filter: NULL or 'All' means "all departments"
    // Admins see all departments, others are filtered
    if (!isAdmin) {
      if (req.user.department) {
        query += ' AND (a.target_department IS NULL OR a.target_department = ? OR a.target_department = ?)';
        params.push(req.user.department, 'All');
      } else {
        query += ' AND (a.target_department IS NULL OR a.target_department = ?)';
        params.push('All');
      }
    }

    // Filter out expired announcements for everyone
    query += ' AND (a.expires_at IS NULL OR a.expires_at > NOW())';

    query += ' ORDER BY a.is_pinned DESC, a.created_at DESC';

    console.log('Announcements query:', query);
    console.log('Query params:', params);
    console.log('User role:', req.user.role, 'User department:', req.user.department);

    const [announcements] = await pool.execute(query, params);

    console.log('Found announcements:', announcements.length);

    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Get single announcement
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [announcements] = await pool.execute(
      `SELECT a.*, p.full_name as author_name
       FROM announcements a
       LEFT JOIN profiles p ON a.author_id = p.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (announcements.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json(announcements[0]);
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

// Create announcement
router.post('/', authenticateToken, requireManager, [
  body('title').trim().notEmpty(),
  body('content').trim().notEmpty(),
  body('target_role').optional().isIn(['admin', 'manager', 'employee', 'all']),
  body('target_department').optional(),
  body('is_pinned').optional().isBoolean(),
  body('expires_at').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, target_role, target_department, is_pinned = false, expires_at } = req.body;
    
    // Normalize 'all' or empty string to null (null means visible to all roles)
    const normalizedTargetRole = (target_role === 'all' || target_role === '' || !target_role) ? null : target_role;
    
    // Normalize 'all' or empty string to null for department (null means visible to all departments)
    const normalizedTargetDepartment = (target_department === 'all' || target_department === '' || !target_department) ? null : target_department;

    const announcementId = uuidv4();
    await pool.execute(
      `INSERT INTO announcements (id, title, content, author_id, target_role, target_department, is_pinned, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [announcementId, title, content, req.user.id, normalizedTargetRole, normalizedTargetDepartment, is_pinned, expires_at || null]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'announcement_created', 'announcements', `Created announcement: ${title}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [newAnnouncement] = await pool.execute(
      `SELECT a.*, p.full_name as author_name
       FROM announcements a
       LEFT JOIN profiles p ON a.author_id = p.id
       WHERE a.id = ?`,
      [announcementId]
    );

    res.status(201).json(newAnnouncement[0]);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Update announcement
router.put('/:id', authenticateToken, requireManager, [
  body('title').optional().trim().notEmpty(),
  body('content').optional().trim().notEmpty(),
  body('target_role').optional().isIn(['admin', 'manager', 'employee', 'all']),
  body('is_pinned').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = {};
    const allowedFields = ['title', 'content', 'is_pinned', 'expires_at'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle target_role separately
    if (req.body.target_role !== undefined) {
      // Normalize 'all' or empty string to null (null means visible to all roles)
      updates.target_role = (req.body.target_role === 'all' || req.body.target_role === '' || !req.body.target_role) ? null : req.body.target_role;
    }

    // Handle target_department separately
    if (req.body.target_department !== undefined) {
      // Normalize 'all' or empty string to null (null means visible to all departments)
      updates.target_department = (req.body.target_department === 'all' || req.body.target_department === '' || !req.body.target_department) ? null : req.body.target_department;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE announcements SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'announcement_updated', 'announcements', `Updated announcement: ${req.params.id}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT a.*, p.full_name as author_name
       FROM announcements a
       LEFT JOIN profiles p ON a.author_id = p.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// Delete announcement
router.delete('/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    await pool.execute('DELETE FROM announcements WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'announcement_deleted', 'announcements', `Deleted announcement: ${req.params.id}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
