import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all salaries (admin can see all, employees can see their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    
    let query = `
      SELECT s.id,
             s.employee_id,
             s.base_salary,
             s.allowances,
             s.deductions,
             s.net_salary,
             s.effective_from,
             s.effective_to,
             s.notes,
             s.is_active,
             s.created_by,
             s.created_at,
             s.updated_at,
             p.full_name as employee_name,
             p.email as employee_email,
             p.employee_id as employee_code,
             creator.full_name as created_by_name
      FROM salaries s
      LEFT JOIN profiles p ON s.employee_id = p.id
      LEFT JOIN profiles creator ON s.created_by = creator.id
    `;
    let params = [];

    if (isAdmin) {
      query += ' ORDER BY s.effective_from DESC, p.full_name ASC';
    } else {
      query += ' WHERE s.employee_id = ? ORDER BY s.effective_from DESC';
      params.push(req.user.id);
    }

    const [salaries] = await pool.execute(query, params);
    res.json(salaries);
  } catch (error) {
    console.error('Get salaries error:', error);
    res.status(500).json({ error: 'Failed to fetch salaries' });
  }
});

// Get payment summary for all employees (admin only) - shows final payment amounts
router.get('/payment-summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get optional month filter from query params (format: YYYY-MM)
    const { month } = req.query;
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

    // Get all active employees (including admins)
    const [employees] = await pool.execute(
      `SELECT id, full_name, email, employee_id, role
       FROM profiles 
       WHERE is_active = true
       ORDER BY full_name ASC`
    );

    const paymentSummary = await Promise.all(
      employees.map(async (employee) => {
        // Get current active salary
        const [salaries] = await pool.execute(
          `SELECT * FROM salaries 
           WHERE employee_id = ? 
             AND is_active = true
             AND (effective_to IS NULL OR effective_to >= CURDATE())
             AND effective_from <= CURDATE()
           ORDER BY effective_from DESC
           LIMIT 1`,
          [employee.id]
        );

        let baseSalary = 0;
        let allowances = 0;
        let deductions = 0;
        let netSalary = 0;

        if (salaries.length > 0) {
          baseSalary = parseFloat(salaries[0].base_salary);
          allowances = parseFloat(salaries[0].allowances);
          deductions = parseFloat(salaries[0].deductions);
          netSalary = parseFloat(salaries[0].net_salary);
        }

        // Get all expenses (regardless of status - for reporting purposes)
        // Filtered by month if provided
        let expenseQuery = `SELECT SUM(amount) as total_expenses, COUNT(*) as expense_count
           FROM expenses
           WHERE employee_id = ?`;
        let expenseParams = [employee.id];
        
        if (targetYear && targetMonth) {
          expenseQuery += ` AND YEAR(expense_date) = ? AND MONTH(expense_date) = ?`;
          expenseParams.push(targetYear, targetMonth);
        }
        
        const [expenses] = await pool.execute(expenseQuery, expenseParams);
        const totalExpenses = parseFloat(expenses[0]?.total_expenses || 0);
        const expenseCount = parseInt(expenses[0]?.expense_count || 0);

        // Get all advance salary deductions (regardless of status - for reporting purposes)
        // Filtered by month if provided
        let advanceQuery = `SELECT SUM(amount) as total_advance, COUNT(*) as advance_count
           FROM advance_salaries
           WHERE employee_id = ?`;
        let advanceParams = [employee.id];
        
        if (targetYear && targetMonth) {
          advanceQuery += ` AND YEAR(request_date) = ? AND MONTH(request_date) = ?`;
          advanceParams.push(targetYear, targetMonth);
        }
        
        const [advances] = await pool.execute(advanceQuery, advanceParams);
        const totalAdvance = parseFloat(advances[0]?.total_advance || 0);
        const advanceCount = parseInt(advances[0]?.advance_count || 0);

        // Calculate final payment
        const finalPayment = netSalary + totalExpenses - totalAdvance;

        // Check payment status for the selected month (if month filter is provided)
        let payment_status = 'pending'; // pending, paid, partial, none
        if (targetYear && targetMonth) {
          // Check if all expenses for this month are paid
          const [monthExpenses] = await pool.execute(
            `SELECT 
               COUNT(*) as total_count,
               SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
               SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as pending_amount,
               SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount
             FROM expenses
             WHERE employee_id = ? 
               AND YEAR(expense_date) = ? 
               AND MONTH(expense_date) = ?
               AND employee_id IS NOT NULL`,
            [employee.id, targetYear, targetMonth]
          );

          // Check if all advances for this month are paid
          const [monthAdvances] = await pool.execute(
            `SELECT 
               COUNT(*) as total_count,
               SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
               SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as pending_amount,
               SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount
             FROM advance_salaries
             WHERE employee_id = ? 
               AND YEAR(request_date) = ? 
               AND MONTH(request_date) = ?`,
            [employee.id, targetYear, targetMonth]
          );

          const expenseTotal = parseInt(monthExpenses[0]?.total_count || 0);
          const expensePaid = parseInt(monthExpenses[0]?.paid_count || 0);
          const advanceTotal = parseInt(monthAdvances[0]?.total_count || 0);
          const advancePaid = parseInt(monthAdvances[0]?.paid_count || 0);

          const totalItems = expenseTotal + advanceTotal;
          const paidItems = expensePaid + advancePaid;

          if (totalItems === 0) {
            payment_status = 'none'; // No expenses/advances for this month
          } else if (paidItems === totalItems) {
            payment_status = 'paid'; // All items paid
          } else if (paidItems > 0) {
            payment_status = 'partial'; // Some items paid
          } else {
            payment_status = 'pending'; // Nothing paid yet
          }
        }

        // Check if salary has been explicitly marked as paid by admin
        let salary_received = false;
        let salary_paid_at = null;
        
        if (targetYear && targetMonth && netSalary > 0) {
          const paymentMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
          const [salaryPayments] = await pool.execute(
            `SELECT paid_at, amount, paid_by
             FROM salary_payments
             WHERE employee_id = ? 
               AND payment_month = ?`,
            [employee.id, paymentMonth]
          );
          
          if (salaryPayments.length > 0) {
            salary_received = true;
            salary_paid_at = salaryPayments[0].paid_at;
          }
        }

        return {
          employee_id: employee.id,
          employee_name: employee.full_name,
          employee_email: employee.email,
          employee_code: employee.employee_id,
          role: employee.role,
          base_salary: baseSalary,
          allowances: allowances,
          deductions: deductions,
          net_salary: netSalary,
          total_expenses: totalExpenses,
          expense_count: expenseCount,
          total_advance: totalAdvance,
          advance_count: advanceCount,
          final_payment: finalPayment,
          payment_status: payment_status,
          salary_received: salary_received,
          salary_paid_at: salary_paid_at
        };
      })
    );

    res.json(paymentSummary);
  } catch (error) {
    console.error('Get payment summary error:', error);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

// Get single salary
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    
    let query = `
      SELECT s.id,
             s.employee_id,
             s.base_salary,
             s.allowances,
             s.deductions,
             s.net_salary,
             s.effective_from,
             s.effective_to,
             s.notes,
             s.is_active,
             s.created_by,
             s.created_at,
             s.updated_at,
             p.full_name as employee_name,
             p.email as employee_email,
             p.employee_id as employee_code,
             creator.full_name as created_by_name
      FROM salaries s
      LEFT JOIN profiles p ON s.employee_id = p.id
      LEFT JOIN profiles creator ON s.created_by = creator.id
      WHERE s.id = ?
    `;
    let params = [req.params.id];

    if (!isAdmin) {
      query += ' AND s.employee_id = ?';
      params.push(req.user.id);
    }

    const [salaries] = await pool.execute(query, params);

    if (salaries.length === 0) {
      return res.status(404).json({ error: 'Salary not found' });
    }

    res.json(salaries[0]);
  } catch (error) {
    console.error('Get salary error:', error);
    res.status(500).json({ error: 'Failed to fetch salary' });
  }
});

// Get current salary for employee (with expenses included)
router.get('/employee/:employeeId/current', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const employeeId = req.params.employeeId;

    // Employees can only view their own salary
    if (!isAdmin && employeeId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [salaries] = await pool.execute(
      `SELECT s.id,
              s.employee_id,
              s.base_salary,
              s.allowances,
              s.deductions,
              s.net_salary,
              s.effective_from,
              s.effective_to,
              s.notes,
              s.is_active,
              s.created_by,
              s.created_at,
              s.updated_at,
              p.full_name as employee_name,
              p.email as employee_email,
              p.employee_id as employee_code,
              creator.full_name as created_by_name
       FROM salaries s
       LEFT JOIN profiles p ON s.employee_id = p.id
       LEFT JOIN profiles creator ON s.created_by = creator.id
       WHERE s.employee_id = ? 
         AND s.is_active = true
         AND (s.effective_to IS NULL OR s.effective_to >= CURDATE())
         AND s.effective_from <= CURDATE()
       ORDER BY s.effective_from DESC
       LIMIT 1`,
      [employeeId]
    );

    if (salaries.length === 0) {
      return res.status(404).json({ error: 'No active salary found for this employee' });
    }

    const salary = salaries[0];

    // Get unpaid approved expenses for this employee (not yet reimbursed)
    // Only expenses with status 'approved' (not 'paid') are included in salary calculation
    const [expenses] = await pool.execute(
      `SELECT SUM(amount) as total_expenses, COUNT(*) as expense_count
       FROM expenses
       WHERE employee_id = ? AND status = 'approved'`,
      [employeeId]
    );

    const totalExpenses = parseFloat(expenses[0]?.total_expenses || 0);
    const expenseCount = parseInt(expenses[0]?.expense_count || 0);

    // Get advance salary amount that needs to be deducted (only approved, not paid - paid advances are already deducted)
    const [advances] = await pool.execute(
      `SELECT SUM(amount) as total_advance
       FROM advance_salaries
       WHERE employee_id = ? AND status = 'approved'`,
      [employeeId]
    );

    const totalAdvance = parseFloat(advances[0]?.total_advance || 0);

    // Calculate final salary: base + expenses - advance salary
    const finalSalary = parseFloat(salary.net_salary) + totalExpenses - totalAdvance;

    res.json({
      ...salary,
      total_expenses: totalExpenses,
      expense_count: expenseCount,
      total_advance: totalAdvance,
      final_salary: finalSalary
    });
  } catch (error) {
    console.error('Get current salary error:', error);
    res.status(500).json({ error: 'Failed to fetch current salary' });
  }
});

// Create salary (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('employee_id').notEmpty().withMessage('Employee ID is required'),
  body('base_salary').isFloat({ min: 0 }).withMessage('Base salary must be 0 or greater'),
  body('allowances').optional().isFloat({ min: 0 }),
  body('deductions').optional().isFloat({ min: 0 }),
  body('effective_from').isISO8601().toDate().withMessage('Valid effective from date is required'),
  body('effective_to').optional().isISO8601().toDate(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employee_id, base_salary, allowances = 0, deductions = 0, effective_from, effective_to, notes } = req.body;

    // Verify employee exists
    const [employees] = await pool.execute(
      'SELECT id FROM profiles WHERE id = ?',
      [employee_id]
    );

    if (employees.length === 0) {
      return res.status(400).json({ error: 'Employee not found' });
    }

    // Calculate net salary
    const net_salary = parseFloat(base_salary) + parseFloat(allowances) - parseFloat(deductions);

    // Deactivate previous active salaries for this employee if they overlap
    if (effective_to) {
      await pool.execute(
        `UPDATE salaries 
         SET is_active = false 
         WHERE employee_id = ? 
           AND is_active = true
           AND ((effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?))
                OR (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)))`,
        [employee_id, effective_from, effective_from, effective_to, effective_to]
      );
    } else {
      // If no end date, deactivate all future salaries
      await pool.execute(
        `UPDATE salaries 
         SET is_active = false 
         WHERE employee_id = ? 
           AND is_active = true
           AND effective_from >= ?`,
        [employee_id, effective_from]
      );
    }

    const salaryId = uuidv4();

    await pool.execute(
      `INSERT INTO salaries (id, employee_id, base_salary, allowances, deductions, net_salary, effective_from, effective_to, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [salaryId, employee_id, base_salary, allowances, deductions, net_salary, effective_from, effective_to || null, notes || null, req.user.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'salary_created', 'salaries', `Created salary for employee: ${employee_id}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    const [newSalary] = await pool.execute(
      `SELECT s.id,
              s.employee_id,
              s.base_salary,
              s.allowances,
              s.deductions,
              s.net_salary,
              s.effective_from,
              s.effective_to,
              s.notes,
              s.is_active,
              s.created_by,
              s.created_at,
              s.updated_at,
              p.full_name as employee_name,
              p.email as employee_email,
              p.employee_id as employee_code,
              creator.full_name as created_by_name
       FROM salaries s
       LEFT JOIN profiles p ON s.employee_id = p.id
       LEFT JOIN profiles creator ON s.created_by = creator.id
       WHERE s.id = ?`,
      [salaryId]
    );

    res.status(201).json(newSalary[0]);
  } catch (error) {
    console.error('Create salary error:', error);
    res.status(500).json({ error: 'Failed to create salary' });
  }
});

// Update salary (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('base_salary').optional().isFloat({ min: 0 }),
  body('allowances').optional().isFloat({ min: 0 }),
  body('deductions').optional().isFloat({ min: 0 }),
  body('effective_from').optional().isISO8601().toDate(),
  body('effective_to').optional().isISO8601().toDate(),
  body('notes').optional().trim(),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { base_salary, allowances, deductions, effective_from, effective_to, notes, is_active } = req.body;
    const updates = {};

    // Get existing salary to recalculate net_salary if needed
    const [existing] = await pool.execute(
      'SELECT * FROM salaries WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Salary not found' });
    }

    const currentBase = base_salary !== undefined ? base_salary : existing[0].base_salary;
    const currentAllowances = allowances !== undefined ? allowances : existing[0].allowances;
    const currentDeductions = deductions !== undefined ? deductions : existing[0].deductions;

    if (base_salary !== undefined) updates.base_salary = base_salary;
    if (allowances !== undefined) updates.allowances = allowances;
    if (deductions !== undefined) updates.deductions = deductions;
    if (effective_from !== undefined) updates.effective_from = effective_from;
    if (effective_to !== undefined) updates.effective_to = effective_to || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (is_active !== undefined) updates.is_active = is_active;

    // Recalculate net salary
    updates.net_salary = parseFloat(currentBase) + parseFloat(currentAllowances) - parseFloat(currentDeductions);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE salaries SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'salary_updated', 'salaries', `Updated salary: ${req.params.id}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT s.id,
              s.employee_id,
              s.base_salary,
              s.allowances,
              s.deductions,
              s.net_salary,
              s.effective_from,
              s.effective_to,
              s.notes,
              s.is_active,
              s.created_by,
              s.created_at,
              s.updated_at,
              p.full_name as employee_name,
              p.email as employee_email,
              p.employee_id as employee_code,
              creator.full_name as created_by_name
       FROM salaries s
       LEFT JOIN profiles p ON s.employee_id = p.id
       LEFT JOIN profiles creator ON s.created_by = creator.id
       WHERE s.id = ?`,
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update salary error:', error);
    res.status(500).json({ error: 'Failed to update salary' });
  }
});

// Delete salary (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM salaries WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'salary_deleted', 'salaries', `Deleted salary: ${req.params.id}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Salary deleted successfully' });
  } catch (error) {
    console.error('Delete salary error:', error);
    res.status(500).json({ error: 'Failed to delete salary' });
  }
});

// Mark salary as paid for a specific month (admin only)
router.post('/mark-paid', authenticateToken, requireAdmin, [
  body('employee_id').notEmpty().withMessage('Employee ID is required'),
  body('payment_month').notEmpty().withMessage('Payment month is required'),
  body('amount').optional().isFloat({ min: 0 }),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employee_id, payment_month, amount, notes } = req.body;

    // Parse payment month
    let paymentMonthDate;
    if (typeof payment_month === 'string' && payment_month.includes('-')) {
      const dateStr = payment_month.split('-').length === 2 
        ? `${payment_month}-01` 
        : payment_month;
      paymentMonthDate = new Date(dateStr);
      if (isNaN(paymentMonthDate.getTime())) {
        return res.status(400).json({ error: 'Invalid payment_month format. Expected YYYY-MM' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid payment_month format. Expected YYYY-MM' });
    }

    // Get employee's current salary to determine amount if not provided
    let paymentAmount = amount;
    if (!paymentAmount) {
      const [salaries] = await pool.execute(
        `SELECT net_salary
         FROM salaries 
         WHERE employee_id = ? 
           AND is_active = true
           AND (effective_to IS NULL OR effective_to >= CURDATE())
           AND effective_from <= CURDATE()
         ORDER BY effective_from DESC
         LIMIT 1`,
        [employee_id]
      );

      if (salaries.length === 0) {
        return res.status(404).json({ error: 'No active salary found for this employee' });
      }

      // Get expenses and advances for the month to calculate final payment
      const year = paymentMonthDate.getFullYear();
      const month = paymentMonthDate.getMonth() + 1;

      const [expenses] = await pool.execute(
        `SELECT SUM(amount) as total
         FROM expenses
         WHERE employee_id = ? 
           AND status = 'paid'
           AND YEAR(expense_date) = ? 
           AND MONTH(expense_date) = ?`,
        [employee_id, year, month]
      );

      const [advances] = await pool.execute(
        `SELECT SUM(amount) as total
         FROM advance_salaries
         WHERE employee_id = ? 
           AND status = 'paid'
           AND YEAR(request_date) = ? 
           AND MONTH(request_date) = ?`,
        [employee_id, year, month]
      );

      const netSalary = parseFloat(salaries[0].net_salary);
      const expenseReimbursement = parseFloat(expenses[0]?.total || 0);
      const advanceDeduction = parseFloat(advances[0]?.total || 0);
      paymentAmount = netSalary + expenseReimbursement - advanceDeduction;
    }

    // Check if already marked as paid
    const [existing] = await pool.execute(
      `SELECT id FROM salary_payments 
       WHERE employee_id = ? AND payment_month = ?`,
      [employee_id, paymentMonthDate]
    );

    const paymentId = uuidv4();
    
    if (existing.length > 0) {
      // Update existing record
      await pool.execute(
        `UPDATE salary_payments 
         SET amount = ?, paid_by = ?, notes = ?, updated_at = NOW()
         WHERE employee_id = ? AND payment_month = ?`,
        [paymentAmount, req.user.id, notes || null, employee_id, paymentMonthDate]
      );
    } else {
      // Create new record
      await pool.execute(
        `INSERT INTO salary_payments (id, employee_id, payment_month, amount, paid_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [paymentId, employee_id, paymentMonthDate, paymentAmount, req.user.id, notes || null]
      );
    }

    // Log audit event
    await logAuditEvent(req.user.id, 'salary_marked_paid', 'salary_payments', `Marked salary as paid for employee: ${employee_id}, month: ${payment_month}`, 'high', 'data_modification', req.ip, req.get('user-agent'));

    const [payment] = await pool.execute(
      `SELECT sp.*, 
              p.full_name as employee_name,
              paid_by_user.full_name as paid_by_name
       FROM salary_payments sp
       LEFT JOIN profiles p ON sp.employee_id = p.id
       LEFT JOIN profiles paid_by_user ON sp.paid_by = paid_by_user.id
       WHERE sp.employee_id = ? AND sp.payment_month = ?`,
      [employee_id, paymentMonthDate]
    );

    res.json(payment[0]);
  } catch (error) {
    console.error('Mark salary paid error:', error);
    res.status(500).json({ error: 'Failed to mark salary as paid' });
  }
});

export default router;
