import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all income entries (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT i.*, 
             p.full_name as created_by_name
      FROM income i
      LEFT JOIN profiles p ON i.created_by = p.id
    `;
    let params = [];

    if (start_date && end_date) {
      query += ' WHERE i.income_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY i.income_date DESC, i.created_at DESC';

    const [income] = await pool.execute(query, params);
    res.json(income);
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({ error: 'Failed to fetch income' });
  }
});

// Get monthly financial summary (MUST come before /:id route)
router.get('/monthly-summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM
    
    // Parse month
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
    } else {
      // Default to current month
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }

    // Get total income for the month
    const [incomeStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_entries,
        SUM(amount) as total_income,
        AVG(amount) as average_income,
        MIN(amount) as min_income,
        MAX(amount) as max_income
       FROM income
       WHERE YEAR(income_date) = ? AND MONTH(income_date) = ?`,
      [targetYear, targetMonth]
    );

    // Get income by category for the month
    const [incomeByCategoryRaw] = await pool.execute(
      `SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
       FROM income
       WHERE YEAR(income_date) = ? AND MONTH(income_date) = ?
       GROUP BY category
       ORDER BY total DESC`,
      [targetYear, targetMonth]
    );
    const incomeByCategory = incomeByCategoryRaw.map(cat => ({
      category: cat.category,
      count: parseInt(cat.count || 0),
      total: parseFloat(cat.total || 0)
    }));

    // Get total expenses for the month (all expenses - office and employee)
    const [expenseStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_entries,
        SUM(amount) as total_expenses,
        SUM(CASE WHEN employee_id IS NULL THEN amount ELSE 0 END) as office_expenses,
        SUM(CASE WHEN employee_id IS NOT NULL THEN amount ELSE 0 END) as employee_expenses,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_expenses,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as pending_expenses
       FROM expenses
       WHERE YEAR(expense_date) = ? AND MONTH(expense_date) = ?`,
      [targetYear, targetMonth]
    );

    // Get expenses by category for the month (include all expenses, even without categories)
    const [expensesByCategoryRaw] = await pool.execute(
      `SELECT 
        COALESCE(ec.name, 'Uncategorized') as category_name,
        COUNT(*) as count,
        SUM(e.amount) as total,
        SUM(CASE WHEN e.employee_id IS NULL THEN e.amount ELSE 0 END) as office_amount,
        SUM(CASE WHEN e.employee_id IS NOT NULL THEN e.amount ELSE 0 END) as employee_amount
       FROM expenses e
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE YEAR(e.expense_date) = ? AND MONTH(e.expense_date) = ?
       GROUP BY ec.id, COALESCE(ec.name, 'Uncategorized')
       ORDER BY total DESC`,
      [targetYear, targetMonth]
    );
    const expensesByCategory = expensesByCategoryRaw.map(cat => ({
      category_name: cat.category_name,
      count: parseInt(cat.count || 0),
      total: parseFloat(cat.total || 0),
      office_amount: parseFloat(cat.office_amount || 0),
      employee_amount: parseFloat(cat.employee_amount || 0)
    }));

    // Get total salaries paid for the month (from payment summary)
    // This includes base salaries + expense reimbursements - advance deductions
    // Includes all active users (employees, managers, and admins)
    const [employees] = await pool.execute(
      `SELECT id FROM profiles WHERE is_active = true`
    );

    let totalSalariesPaid = 0;
    let totalBaseSalaries = 0;
    let totalExpenseReimbursements = 0;
    let totalAdvanceDeductions = 0;
    let employeeCount = 0;

    const paymentMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    
    for (const employee of employees) {
      // First, check if salary was explicitly marked as paid in salary_payments table
      const [salaryPayments] = await pool.execute(
        `SELECT amount FROM salary_payments
         WHERE employee_id = ? AND payment_month = ?`,
        [employee.id, paymentMonth]
      );

      if (salaryPayments.length > 0) {
        // Use the explicitly marked salary payment amount
        const paidAmount = parseFloat(salaryPayments[0].amount);
        totalSalariesPaid += paidAmount;
        employeeCount++;
        
        // Get base salary for breakdown
        const [salaries] = await pool.execute(
          `SELECT net_salary FROM salaries 
           WHERE employee_id = ? 
             AND is_active = true
             AND (effective_to IS NULL OR effective_to >= CURDATE())
             AND effective_from <= CURDATE()
           ORDER BY effective_from DESC
           LIMIT 1`,
          [employee.id]
        );
        if (salaries.length > 0) {
          totalBaseSalaries += parseFloat(salaries[0].net_salary);
        }
      } else {
        // Calculate based on salary + expenses - advances (for employees with salaries but not explicitly marked)
        const [salaries] = await pool.execute(
          `SELECT base_salary, allowances, deductions, net_salary
           FROM salaries 
           WHERE employee_id = ? 
             AND is_active = true
             AND (effective_to IS NULL OR effective_to >= CURDATE())
             AND effective_from <= CURDATE()
           ORDER BY effective_from DESC
           LIMIT 1`,
          [employee.id]
        );

        if (salaries.length > 0) {
          const netSalary = parseFloat(salaries[0].net_salary);
          totalBaseSalaries += netSalary;
          employeeCount++;

          // Get paid expenses for this month (reimbursements)
          const [paidExpenses] = await pool.execute(
            `SELECT SUM(amount) as total
             FROM expenses
             WHERE employee_id = ? 
               AND status = 'paid'
               AND YEAR(expense_date) = ? 
               AND MONTH(expense_date) = ?`,
            [employee.id, targetYear, targetMonth]
          );
          const expenseReimbursement = parseFloat(paidExpenses[0]?.total || 0);
          totalExpenseReimbursements += expenseReimbursement;

          // Get paid advance salaries for this month (deductions)
          const [paidAdvances] = await pool.execute(
            `SELECT SUM(amount) as total
             FROM advance_salaries
             WHERE employee_id = ? 
               AND status = 'paid'
               AND YEAR(request_date) = ? 
               AND MONTH(request_date) = ?`,
            [employee.id, targetYear, targetMonth]
          );
          const advanceDeduction = parseFloat(paidAdvances[0]?.total || 0);
          totalAdvanceDeductions += advanceDeduction;

          // Final payment = base salary + expense reimbursements - advance deductions
          const finalPayment = netSalary + expenseReimbursement - advanceDeduction;
          totalSalariesPaid += finalPayment;
        }
      }
    }

    // Get total advance salaries approved/paid for the month
    const [advanceStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_entries,
        SUM(amount) as total_advances,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_advances,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as pending_advances
       FROM advance_salaries
       WHERE YEAR(request_date) = ? AND MONTH(request_date) = ?`,
      [targetYear, targetMonth]
    );

    // Calculate net income
    const totalIncome = parseFloat(incomeStats[0]?.total_income || 0);
    const totalExpenses = parseFloat(expenseStats[0]?.total_expenses || 0);
    const netIncome = totalIncome - totalExpenses - totalSalariesPaid;

    res.json({
      month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      year: targetYear,
      month_number: targetMonth,
      income: {
        total: totalIncome,
        entries: parseInt(incomeStats[0]?.total_entries || 0),
        average: parseFloat(incomeStats[0]?.average_income || 0),
        min: parseFloat(incomeStats[0]?.min_income || 0),
        max: parseFloat(incomeStats[0]?.max_income || 0),
        by_category: incomeByCategory
      },
      expenses: {
        total: totalExpenses,
        office: parseFloat(expenseStats[0]?.office_expenses || 0),
        employee: parseFloat(expenseStats[0]?.employee_expenses || 0),
        paid: parseFloat(expenseStats[0]?.paid_expenses || 0),
        pending: parseFloat(expenseStats[0]?.pending_expenses || 0),
        entries: parseInt(expenseStats[0]?.total_entries || 0),
        by_category: expensesByCategory
      },
      salaries: {
        total_paid: totalSalariesPaid,
        base_salaries: totalBaseSalaries,
        expense_reimbursements: totalExpenseReimbursements,
        advance_deductions: totalAdvanceDeductions,
        employee_count: employeeCount
      },
      advances: {
        total: parseFloat(advanceStats[0]?.total_advances || 0),
        paid: parseFloat(advanceStats[0]?.paid_advances || 0),
        pending: parseFloat(advanceStats[0]?.pending_advances || 0),
        entries: parseInt(advanceStats[0]?.total_entries || 0)
      },
      net_income: netIncome,
      summary: {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        total_salaries: totalSalariesPaid,
        net_income: netIncome
      }
    });
  } catch (error) {
    console.error('Get monthly summary error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly financial summary' });
  }
});

// Get income summary/statistics (admin only)
router.get('/stats/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        COUNT(*) as total_entries,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM income
    `;
    let params = [];

    if (start_date && end_date) {
      query += ' WHERE income_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const [stats] = await pool.execute(query, params);

    // Get income by category
    let categoryQuery = `
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income
    `;
    if (start_date && end_date) {
      categoryQuery += ' WHERE income_date BETWEEN ? AND ?';
    }
    categoryQuery += ' GROUP BY category ORDER BY total DESC';

    const [byCategory] = await pool.execute(categoryQuery, params);

    res.json({
      summary: stats[0],
      by_category: byCategory
    });
  } catch (error) {
    console.error('Get income stats error:', error);
    res.status(500).json({ error: 'Failed to fetch income statistics' });
  }
});

// Get categorized summary report (excluding advance salaries) - for PDF export
// MUST come before /:id route
router.get('/categorized-summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM
    
    // Parse month
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
    } else {
      // Default to current month
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }

    // Get income by category
    const [incomeByCategory] = await pool.execute(
      `SELECT 
        COALESCE(category, 'Uncategorized') as category,
        COUNT(*) as count,
        SUM(amount) as total
       FROM income
       WHERE YEAR(income_date) = ? AND MONTH(income_date) = ?
       GROUP BY category
       ORDER BY total DESC`,
      [targetYear, targetMonth]
    );

    // Get expenses by category (excluding advance salaries - those are in advance_salaries table)
    const [expensesByCategory] = await pool.execute(
      `SELECT 
        COALESCE(ec.name, 'Uncategorized') as category_name,
        COUNT(*) as count,
        SUM(e.amount) as total,
        SUM(CASE WHEN e.employee_id IS NULL THEN e.amount ELSE 0 END) as office_amount,
        SUM(CASE WHEN e.employee_id IS NOT NULL THEN e.amount ELSE 0 END) as employee_amount
       FROM expenses e
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE YEAR(e.expense_date) = ? AND MONTH(e.expense_date) = ?
       GROUP BY ec.id, COALESCE(ec.name, 'Uncategorized')
       ORDER BY total DESC`,
      [targetYear, targetMonth]
    );

    // Get total income
    const [incomeTotal] = await pool.execute(
      `SELECT SUM(amount) as total, COUNT(*) as count
       FROM income
       WHERE YEAR(income_date) = ? AND MONTH(income_date) = ?`,
      [targetYear, targetMonth]
    );

    // Get total expenses
    const [expensesTotal] = await pool.execute(
      `SELECT SUM(amount) as total, COUNT(*) as count
       FROM expenses
       WHERE YEAR(expense_date) = ? AND MONTH(expense_date) = ?`,
      [targetYear, targetMonth]
    );

    // Get total salaries (base salaries only, not including advance deductions)
    const [employees] = await pool.execute(
      `SELECT id FROM profiles WHERE is_active = true`
    );

    let totalSalaries = 0;
    let employeeCount = 0;

    for (const employee of employees) {
      const [salaries] = await pool.execute(
        `SELECT net_salary
         FROM salaries 
         WHERE employee_id = ? 
           AND is_active = true
           AND (effective_to IS NULL OR effective_to >= CURDATE())
           AND effective_from <= CURDATE()
         ORDER BY effective_from DESC
         LIMIT 1`,
        [employee.id]
      );

      if (salaries.length > 0) {
        totalSalaries += parseFloat(salaries[0].net_salary);
        employeeCount++;
      }
    }

    // Calculate net income (Income - Expenses - Salaries, excluding advance salaries)
    const totalIncome = parseFloat(incomeTotal[0]?.total || 0);
    const totalExpenses = parseFloat(expensesTotal[0]?.total || 0);
    const netIncome = totalIncome - totalExpenses - totalSalaries;

    res.json({
      month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      year: targetYear,
      month_number: targetMonth,
      income: {
        total: totalIncome,
        count: parseInt(incomeTotal[0]?.count || 0),
        by_category: incomeByCategory.map(cat => ({
          category: cat.category,
          count: parseInt(cat.count || 0),
          total: parseFloat(cat.total || 0)
        }))
      },
      expenses: {
        total: totalExpenses,
        count: parseInt(expensesTotal[0]?.count || 0),
        by_category: expensesByCategory.map(cat => ({
          category_name: cat.category_name,
          count: parseInt(cat.count || 0),
          total: parseFloat(cat.total || 0),
          office_amount: parseFloat(cat.office_amount || 0),
          employee_amount: parseFloat(cat.employee_amount || 0)
        }))
      },
      salaries: {
        total: totalSalaries,
        employee_count: employeeCount
      },
      net_income: netIncome,
      summary: {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        total_salaries: totalSalaries,
        net_income: netIncome
      }
    });
  } catch (error) {
    console.error('Get categorized summary error:', error);
    res.status(500).json({ error: 'Failed to fetch categorized summary' });
  }
});

// Get single income entry (MUST come after specific routes like /monthly-summary, /stats/summary, and /categorized-summary)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [income] = await pool.execute(
      `SELECT i.*, 
              p.full_name as created_by_name
       FROM income i
       LEFT JOIN profiles p ON i.created_by = p.id
       WHERE i.id = ?`,
      [req.params.id]
    );

    if (income.length === 0) {
      return res.status(404).json({ error: 'Income entry not found' });
    }

    res.json(income[0]);
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({ error: 'Failed to fetch income entry' });
  }
});

// Create income entry (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('income_date').isISO8601().toDate().withMessage('Valid income date is required'),
  body('description').optional().trim(),
  body('category').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, amount, income_date, description, category } = req.body;
    const incomeId = uuidv4();

    await pool.execute(
      `INSERT INTO income (id, title, amount, description, income_date, category, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [incomeId, title, amount, description || null, income_date, category || null, req.user.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'income_created', 'income', `Created income: ${title} - ${amount}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [newIncome] = await pool.execute(
      `SELECT i.*, 
              p.full_name as created_by_name
       FROM income i
       LEFT JOIN profiles p ON i.created_by = p.id
       WHERE i.id = ?`,
      [incomeId]
    );

    res.status(201).json(newIncome[0]);
  } catch (error) {
    console.error('Create income error:', error);
    res.status(500).json({ error: 'Failed to create income entry' });
  }
});

// Update income entry (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('title').optional().trim().notEmpty(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('income_date').optional().isISO8601().toDate(),
  body('description').optional().trim(),
  body('category').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, amount, income_date, description, category } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (amount !== undefined) updates.amount = amount;
    if (income_date !== undefined) updates.income_date = income_date;
    if (description !== undefined) updates.description = description || null;
    if (category !== undefined) updates.category = category || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE income SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'income_updated', 'income', `Updated income: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT i.*, 
              p.full_name as created_by_name
       FROM income i
       LEFT JOIN profiles p ON i.created_by = p.id
       WHERE i.id = ?`,
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({ error: 'Failed to update income entry' });
  }
});

// Delete income entry (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM income WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'income_deleted', 'income', `Deleted income: ${req.params.id}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Income entry deleted successfully' });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({ error: 'Failed to delete income entry' });
  }
});

export default router;
