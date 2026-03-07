import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin, requireManager } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';
import { toDateOnlyString, formatExpenseDateForStore } from '../utils/date.js';

const router = express.Router();

function formatExpenseForResponse(expense) {
  if (!expense) return expense;
  return { ...expense, expense_date: toDateOnlyString(expense.expense_date) ?? expense.expense_date };
}

// Get all expenses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isAdminOrManager = req.user.role === 'admin' || req.user.role === 'manager';
    
    let query = `
      SELECT e.id, e.employee_id, e.category_id, e.amount, e.description,
             DATE_FORMAT(e.expense_date, '%Y-%m-%d') as expense_date,
             e.receipt_url, e.status, e.approved_by, e.approved_at, e.paid_at,
             e.rejection_reason, e.created_at, e.updated_at,
             p.full_name as employee_name,
             p.employee_id as employee_code,
             ec.name as category_name
      FROM expenses e
      LEFT JOIN profiles p ON e.employee_id = p.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
    `;
    let params = [];

    if (isAdminOrManager) {
      // Admin/Manager can see all expenses
      query += ' ORDER BY e.created_at DESC';
    } else {
      // Employees can only see their own expenses
      query += ' WHERE e.employee_id = ? ORDER BY e.created_at DESC';
      params.push(req.user.id);
    }

    const [expenses] = await pool.execute(query, params);
    res.json(expenses.map(formatExpenseForResponse));
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get single expense
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const isAdminOrManager = req.user.role === 'admin' || req.user.role === 'manager';
    
    let query = `
      SELECT e.id, e.employee_id, e.category_id, e.amount, e.description,
             DATE_FORMAT(e.expense_date, '%Y-%m-%d') as expense_date,
             e.receipt_url, e.status, e.approved_by, e.approved_at, e.paid_at,
             e.rejection_reason, e.created_at, e.updated_at,
             p.full_name as employee_name,
             p.employee_id as employee_code,
             ec.name as category_name
      FROM expenses e
      LEFT JOIN profiles p ON e.employee_id = p.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.id = ?
    `;
    let params = [req.params.id];

    if (!isAdminOrManager) {
      // Employees can only view their own expenses
      query += ' AND e.employee_id = ?';
      params.push(req.user.id);
    }

    const [expenses] = await pool.execute(query, params);

    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(formatExpenseForResponse(expenses[0]));
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create expense (users can create their own, admin can create for anyone)
router.post('/', authenticateToken, [
  body('category_id').notEmpty().withMessage('Category is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('expense_date').isISO8601().toDate().withMessage('Valid expense date is required'),
  body('employee_id').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { category_id, amount, description, expense_date, receipt_url, employee_id } = req.body;

    // Determine employee_id:
    // - Admin can create office expenses (employee_id = null) or employee expenses (with employee_id)
    // - Non-admin users can only create their own expenses
    let finalEmployeeId = null;
    if (req.user.role === 'admin') {
      // Admin can explicitly set employee_id or leave it null for office expenses
      finalEmployeeId = employee_id || null;
    } else {
      // Non-admin users always create expenses for themselves
      finalEmployeeId = req.user.id;
    }

    // Verify category exists
    const [categories] = await pool.execute(
      'SELECT id FROM expense_categories WHERE id = ? AND is_active = true',
      [category_id]
    );

    if (categories.length === 0) {
      return res.status(400).json({ error: 'Invalid expense category' });
    }

    const expenseId = uuidv4();

    // Auto-approve all expenses
    // - Employee expenses (with employee_id) will be reimbursed at end of month
    // - Office expenses (employee_id = null) are just records, not reimbursable
    
    const expenseDateStr = formatExpenseDateForStore(expense_date);
    await pool.execute(
      `INSERT INTO expenses (id, employee_id, category_id, amount, description, expense_date, receipt_url, status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
      [expenseId, finalEmployeeId, category_id, amount, description, expenseDateStr, receipt_url || null, req.user.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'expense_created', 'expenses', `Created expense: ${amount}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [newExpense] = await pool.execute(
      `SELECT e.id, e.employee_id, e.category_id, e.amount, e.description,
              DATE_FORMAT(e.expense_date, '%Y-%m-%d') as expense_date,
              e.receipt_url, e.status, e.approved_by, e.approved_at, e.paid_at,
              e.rejection_reason, e.created_at, e.updated_at,
              p.full_name as employee_name,
              p.employee_id as employee_code,
              ec.name as category_name
       FROM expenses e
       LEFT JOIN profiles p ON e.employee_id = p.id
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.id = ?`,
      [expenseId]
    );

    res.status(201).json(formatExpenseForResponse(newExpense[0]));
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense (users can update their own pending expenses, admin can update any)
router.put('/:id', authenticateToken, [
  body('category_id').optional().notEmpty(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('description').optional().trim().notEmpty(),
  body('expense_date').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get existing expense
    const [existing] = await pool.execute(
      'SELECT * FROM expenses WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = existing[0];

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = expense.employee_id === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ 
        error: 'You can only update your own expenses' 
      });
    }

    const updates = {};
    const allowedFields = ['category_id', 'amount', 'description', 'expense_date', 'receipt_url'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Verify category if being updated
    if (updates.category_id) {
      const [categories] = await pool.execute(
        'SELECT id FROM expense_categories WHERE id = ? AND is_active = true',
        [updates.category_id]
      );
      if (categories.length === 0) {
        return res.status(400).json({ error: 'Invalid expense category' });
      }
    }

    if (updates.expense_date) {
      updates.expense_date = formatExpenseDateForStore(updates.expense_date);
    }
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE expenses SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'expense_updated', 'expenses', `Updated expense: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT e.id, e.employee_id, e.category_id, e.amount, e.description,
              DATE_FORMAT(e.expense_date, '%Y-%m-%d') as expense_date,
              e.receipt_url, e.status, e.approved_by, e.approved_at, e.paid_at,
              e.rejection_reason, e.created_at, e.updated_at,
              p.full_name as employee_name,
              p.employee_id as employee_code,
              ec.name as category_name
       FROM expenses e
       LEFT JOIN profiles p ON e.employee_id = p.id
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.id = ?`,
      [req.params.id]
    );

    res.json(formatExpenseForResponse(updated[0]));
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Approve/Reject expense (admin/manager only)
router.patch('/:id/status', authenticateToken, requireManager, [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('rejection_reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, rejection_reason } = req.body;

    const [existing] = await pool.execute(
      'SELECT * FROM expenses WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const updates = {
      status,
      approved_by: req.user.id,
      approved_at: new Date()
    };

    if (status === 'rejected' && rejection_reason) {
      updates.rejection_reason = rejection_reason;
    } else {
      updates.rejection_reason = null;
    }

    await pool.execute(
      'UPDATE expenses SET status = ?, approved_by = ?, approved_at = ?, rejection_reason = ? WHERE id = ?',
      [updates.status, updates.approved_by, updates.approved_at, updates.rejection_reason, req.params.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'expense_status_changed', 'expenses', `${status} expense: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT e.id, e.employee_id, e.category_id, e.amount, e.description,
              DATE_FORMAT(e.expense_date, '%Y-%m-%d') as expense_date,
              e.receipt_url, e.status, e.approved_by, e.approved_at, e.paid_at,
              e.rejection_reason, e.created_at, e.updated_at,
              p.full_name as employee_name,
              p.employee_id as employee_code,
              ec.name as category_name
       FROM expenses e
       LEFT JOIN profiles p ON e.employee_id = p.id
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.id = ?`,
      [req.params.id]
    );

    res.json(formatExpenseForResponse(updated[0]));
  } catch (error) {
    console.error('Update expense status error:', error);
    res.status(500).json({ error: 'Failed to update expense status' });
  }
});

// Delete expense (users can delete their own pending expenses, admin can delete any)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM expenses WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = existing[0];
    const isAdmin = req.user.role === 'admin';
    const isOwner = expense.employee_id === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ 
        error: 'You can only delete your own expenses' 
      });
    }

    await pool.execute('DELETE FROM expenses WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'expense_deleted', 'expenses', `Deleted expense: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Get all expenses for a specific month (admin only) - for PDF reports
router.get('/month/:month', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { month } = req.params;
    
    // Parse month (format: YYYY-MM)
    let targetYear = null;
    let targetMonth = null;
    
    if (month && typeof month === 'string') {
      const dateStr = month.includes('-') && month.split('-').length === 2 
        ? `${month}-01` 
        : month;
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        targetYear = date.getFullYear();
        targetMonth = date.getMonth() + 1;
      }
    }
    
    if (!targetYear || !targetMonth) {
      return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
    }

    // Get all expenses for the month (all employees, admin only)
    const [expensesRaw] = await pool.execute(
      `SELECT e.id, e.employee_id, e.category_id, e.amount, e.description,
             DATE_FORMAT(e.expense_date, '%Y-%m-%d') as expense_date,
             e.receipt_url, e.status, e.approved_by, e.approved_at, e.paid_at,
             e.rejection_reason, e.created_at, e.updated_at,
             p.full_name as employee_name,
             p.employee_id as employee_code,
             ec.name as category_name
      FROM expenses e
      LEFT JOIN profiles p ON e.employee_id = p.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE YEAR(e.expense_date) = ? AND MONTH(e.expense_date) = ?
      ORDER BY e.expense_date ASC, e.employee_id ASC`,
      [targetYear, targetMonth]
    );
    const expenses = expensesRaw.map(formatExpenseForResponse);

    console.log(`[Expenses API] Fetched ${expenses.length} expenses for ${targetYear}-${targetMonth}`);
    console.log(`[Expenses API] Employee expenses: ${expenses.filter(e => e.employee_id).length}, Office expenses: ${expenses.filter(e => !e.employee_id).length}`);

    res.json(expenses);
  } catch (error) {
    console.error('Get expenses by month error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses for the month' });
  }
});

// Process month-end payments - mark all approved expenses and advance salaries for a specific month as paid (admin only)
router.post('/process-month-end', authenticateToken, requireAdmin, [
  body('payment_month').optional(),
  body('employee_id').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { payment_month, employee_id } = req.body;
    
    // Default to current month if not specified
    let targetMonth;
    if (payment_month) {
      // express-validator's toDate() converts the string to a Date object
      // If it's already a Date, use it directly; otherwise parse it
      if (payment_month instanceof Date) {
        targetMonth = payment_month;
      } else if (typeof payment_month === 'string') {
        // If it's a string, it might be 'YYYY-MM' or ISO format
        const dateStr = payment_month.includes('-') && payment_month.split('-').length === 2 
          ? `${payment_month}-01` 
          : payment_month;
        targetMonth = new Date(dateStr);
      } else {
        targetMonth = new Date(payment_month);
      }
      
      // Validate date
      if (isNaN(targetMonth.getTime())) {
        return res.status(400).json({ error: 'Invalid payment_month format. Expected YYYY-MM' });
      }
    } else {
      targetMonth = new Date();
    }
    
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth() + 1; // getMonth() returns 0-11

    // Build query to find all approved expenses for the specified month
    let expenseQuery = `
      SELECT id, employee_id, amount 
      FROM expenses 
      WHERE status = 'approved' 
        AND employee_id IS NOT NULL
        AND YEAR(expense_date) = ? 
        AND MONTH(expense_date) = ?
    `;
    let expenseParams = [year, month];

    if (employee_id) {
      expenseQuery += ' AND employee_id = ?';
      expenseParams.push(employee_id);
    }

    console.log('Processing month-end:', { year, month, employee_id, payment_month });
    console.log('Expense query:', expenseQuery);
    console.log('Expense params:', expenseParams);
    
    let expenses = [];
    try {
      const [expenseResults] = await pool.execute(expenseQuery, expenseParams);
      expenses = expenseResults || [];
      console.log('Found expenses:', expenses.length);
    } catch (expenseError) {
      console.error('Error fetching expenses:', expenseError);
      throw new Error(`Failed to fetch expenses: ${expenseError.message}`);
    }

    // Build query to find all approved advance salaries for the specified month
    let advanceQuery = `
      SELECT id, employee_id, amount 
      FROM advance_salaries 
      WHERE status = 'approved' 
        AND YEAR(request_date) = ? 
        AND MONTH(request_date) = ?
    `;
    let advanceParams = [year, month];

    if (employee_id) {
      advanceQuery += ' AND employee_id = ?';
      advanceParams.push(employee_id);
    }

    let advances = [];
    try {
      const [advanceResults] = await pool.execute(advanceQuery, advanceParams);
      advances = advanceResults || [];
      console.log('Found advances:', advances.length);
    } catch (advanceError) {
      console.error('Error fetching advances:', advanceError);
      throw new Error(`Failed to fetch advances: ${advanceError.message}`);
    }

    // Process expenses
    let expenseCount = 0;
    let expenseTotal = 0;
    if (expenses && expenses.length > 0) {
      const expenseIds = expenses.map(e => e.id);
      expenseTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      expenseCount = expenses.length;
      const placeholders = expenseIds.map(() => '?').join(',');

      // Mark all expenses as paid (only for the selected month to ensure safety)
      if (expenseIds.length > 0) {
        try {
          // Double-check: Only update expenses from the selected month
          const updateParams = [...expenseIds, year, month];
          await pool.execute(
            `UPDATE expenses SET status = 'paid', paid_at = NOW() 
             WHERE id IN (${placeholders}) 
               AND YEAR(expense_date) = ? 
               AND MONTH(expense_date) = ?`,
            updateParams
          );
          console.log(`Marked ${expenseIds.length} expenses as paid for ${year}-${String(month).padStart(2, '0')}`);
        } catch (updateError) {
          console.error('Error updating expenses:', updateError);
          throw new Error(`Failed to update expenses: ${updateError.message}`);
        }
      }
    }

    // Process advance salaries
    let advanceCount = 0;
    let advanceTotal = 0;
    if (advances && advances.length > 0) {
      const advanceIds = advances.map(a => a.id);
      advanceTotal = advances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      advanceCount = advances.length;
      const placeholders = advanceIds.map(() => '?').join(',');

      // Mark all advance salaries as paid (only for the selected month to ensure safety)
      if (advanceIds.length > 0) {
        try {
          // Double-check: Only update advances from the selected month
          const updateParams = [...advanceIds, year, month];
          await pool.execute(
            `UPDATE advance_salaries SET status = 'paid', paid_at = NOW() 
             WHERE id IN (${placeholders}) 
               AND YEAR(request_date) = ? 
               AND MONTH(request_date) = ?`,
            updateParams
          );
          console.log(`Marked ${advanceIds.length} advances as paid for ${year}-${String(month).padStart(2, '0')}`);
        } catch (updateError) {
          console.error('Error updating advances:', updateError);
          throw new Error(`Failed to update advances: ${updateError.message}`);
        }
      }
    }

    const totalCount = expenseCount + advanceCount;
    const totalAmount = expenseTotal + advanceTotal;

    if (totalCount === 0) {
      return res.json({ 
        message: 'No expenses or advance salaries found to process for this month',
        month: `${year}-${String(month).padStart(2, '0')}`,
        expense_count: 0,
        expense_total: 0,
        advance_count: 0,
        advance_total: 0,
        total_count: 0,
        total_amount: 0
      });
    }

    // Log audit event (don't fail if logging fails)
    try {
      await logAuditEvent(
        req.user.id, 
        'month_end_processed', 
        'expenses', 
        `Processed month-end payments for ${year}-${String(month).padStart(2, '0')}: ${expenseCount} expenses (£${expenseTotal.toFixed(2)}), ${advanceCount} advances (£${advanceTotal.toFixed(2)})`, 
        'high', 
        'data_modification', 
        req.ip, 
        req.get('user-agent')
      );
    } catch (logError) {
      console.error('Failed to log audit event:', logError);
      // Continue even if logging fails
    }

    const allEmployeeIds = [
      ...(expenses && expenses.length > 0 ? expenses.map(e => e.employee_id) : []),
      ...(advances && advances.length > 0 ? advances.map(a => a.employee_id) : [])
    ];

    res.json({ 
      message: `Month-end processing completed successfully`,
      month: `${year}-${String(month).padStart(2, '0')}`,
      expense_count: expenseCount,
      expense_total: expenseTotal,
      advance_count: advanceCount,
      advance_total: advanceTotal,
      total_count: totalCount,
      total_amount: totalAmount,
      employee_count: allEmployeeIds.length > 0 ? new Set(allEmployeeIds).size : 0
    });
  } catch (error) {
    console.error('Process month-end error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      user: req.user ? { id: req.user.id, role: req.user.role } : 'no user'
    });
    
    const errorResponse = {
      error: 'Failed to process month-end payments',
      message: error.message
    };
    
    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.details = {
        body: req.body,
        user: req.user ? { id: req.user.id, role: req.user.role } : null
      };
    }
    
    res.status(500).json(errorResponse);
  }
});

export default router;
