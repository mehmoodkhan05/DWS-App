import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all expense categories (all authenticated users can view)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM expense_categories WHERE is_active = true ORDER BY name ASC'
    );
    res.json(categories);
  } catch (error) {
    console.error('Get expense categories error:', error);
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
});

// Get single expense category
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM expense_categories WHERE id = ?',
      [req.params.id]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Expense category not found' });
    }

    res.json(categories[0]);
  } catch (error) {
    console.error('Get expense category error:', error);
    res.status(500).json({ error: 'Failed to fetch expense category' });
  }
});

// Create expense category (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    // Check if category already exists
    const [existing] = await pool.execute(
      'SELECT id FROM expense_categories WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Expense category already exists' });
    }

    const categoryId = uuidv4();

    await pool.execute(
      'INSERT INTO expense_categories (id, name, description) VALUES (?, ?, ?)',
      [categoryId, name, description || null]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'expense_category_created', 'expense_categories', `Created category: ${name}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [newCategory] = await pool.execute(
      'SELECT * FROM expense_categories WHERE id = ?',
      [categoryId]
    );

    res.status(201).json(newCategory[0]);
  } catch (error) {
    console.error('Create expense category error:', error);
    res.status(500).json({ error: 'Failed to create expense category' });
  }
});

// Update expense category (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, is_active } = req.body;
    const updates = {};

    if (name !== undefined) {
      // Check if new name conflicts with existing category
      const [existing] = await pool.execute(
        'SELECT id FROM expense_categories WHERE name = ? AND id != ?',
        [name, req.params.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Expense category name already exists' });
      }
      updates.name = name;
    }

    if (description !== undefined) {
      updates.description = description || null;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE expense_categories SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'expense_category_updated', 'expense_categories', `Updated category: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      'SELECT * FROM expense_categories WHERE id = ?',
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update expense category error:', error);
    res.status(500).json({ error: 'Failed to update expense category' });
  }
});

// Delete expense category (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Check if category is used in expenses
    const [expenses] = await pool.execute(
      'SELECT COUNT(*) as count FROM expenses WHERE category_id = ?',
      [req.params.id]
    );

    if (expenses[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category that is being used by expenses. Deactivate it instead.' 
      });
    }

    await pool.execute('DELETE FROM expense_categories WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'expense_category_deleted', 'expense_categories', `Deleted category: ${req.params.id}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Expense category deleted successfully' });
  } catch (error) {
    console.error('Delete expense category error:', error);
    res.status(500).json({ error: 'Failed to delete expense category' });
  }
});

export default router;
