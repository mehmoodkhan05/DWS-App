import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const router = express.Router();

// Get all rotas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rotas] = await pool.execute(
      `SELECT r.*, p.full_name as employee_name, 
              sp.name as shift_pattern_name, sp.type as shift_pattern_type, 
              sp.start_time as shift_pattern_start_time, 
              sp.end_time as shift_pattern_end_time, 
              sp.color as shift_pattern_color
       FROM rotas r
       LEFT JOIN profiles p ON r.employee_id = p.id
       LEFT JOIN shift_patterns sp ON r.shift_pattern_id = sp.id
       ORDER BY r.date ASC`
    );

    // Format the response
    const formattedRotas = rotas.map(rota => {
      // Ensure date is in YYYY-MM-DD format (MySQL DATE returns as Date object)
      // Use local date methods to avoid timezone issues
      let dateStr = rota.date;
      if (dateStr instanceof Date) {
        // Use local date methods instead of toISOString() to prevent timezone shifts
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string') {
        // If it's already a string, ensure it's in YYYY-MM-DD format
        dateStr = dateStr.split('T')[0].split(' ')[0];
      }
      
      return {
        id: rota.id,
        employee_id: rota.employee_id,
        date: dateStr,
        shift_pattern_id: rota.shift_pattern_id,
        notes: rota.notes,
        is_locked: rota.is_locked,
        created_by: rota.created_by,
        created_at: rota.created_at,
        updated_at: rota.updated_at,
        employee_name: rota.employee_name,
        shift_pattern: rota.shift_pattern_id ? {
          name: rota.shift_pattern_name,
          type: rota.shift_pattern_type,
          start_time: rota.shift_pattern_start_time,
          end_time: rota.shift_pattern_end_time,
          color: rota.shift_pattern_color
        } : null
      };
    });

    res.json(formattedRotas);
  } catch (error) {
    console.error('Get rotas error:', error);
    res.status(500).json({ error: 'Failed to fetch rotas' });
  }
});

// Get single rota
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rotas] = await pool.execute(
      `SELECT r.*, p.full_name as employee_name, 
              sp.name as shift_pattern_name, sp.type as shift_pattern_type, 
              sp.start_time as shift_pattern_start_time, 
              sp.end_time as shift_pattern_end_time, 
              sp.color as shift_pattern_color
       FROM rotas r
       LEFT JOIN profiles p ON r.employee_id = p.id
       LEFT JOIN shift_patterns sp ON r.shift_pattern_id = sp.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (rotas.length === 0) {
      return res.status(404).json({ error: 'Rota not found' });
    }

    const rota = rotas[0];
    res.json({
      ...rota,
      employee_name: rota.employee_name,
      shift_pattern: rota.shift_pattern_id ? {
        name: rota.shift_pattern_name,
        type: rota.shift_pattern_type,
        start_time: rota.shift_pattern_start_time,
        end_time: rota.shift_pattern_end_time,
        color: rota.shift_pattern_color
      } : null
    });
  } catch (error) {
    console.error('Get rota error:', error);
    res.status(500).json({ error: 'Failed to fetch rota' });
  }
});

// Helper function to validate shift assignments
const validateAssignments = async (assignments) => {
  if (assignments.length === 0) return;

  // Check for duplicate assignments in the batch
  const byEmployeeDate = new Map();
  for (const a of assignments) {
    const key = `${a.employee_id}|${a.date}`;
    if (byEmployeeDate.has(key)) {
      throw new Error('Cannot assign multiple shifts to the same guard on the same day.');
    }
    byEmployeeDate.set(key, a);
  }

  // Get shift pattern types
  const patternIds = [...new Set(assignments.map(a => a.shift_pattern_id).filter(Boolean))];
  const patternMap = new Map();
  if (patternIds.length > 0) {
    // MySQL requires placeholders for each item in IN clause
    const placeholders = patternIds.map(() => '?').join(',');
    const [patterns] = await pool.execute(
      `SELECT id, type FROM shift_patterns WHERE id IN (${placeholders})`,
      patternIds
    );
    patterns.forEach(p => patternMap.set(p.id, p.type));
  }

  // Get employee IDs and dates
  const employeeIds = [...new Set(assignments.map(a => a.employee_id))];
  const dates = [...new Set(assignments.map(a => a.date))];
  
  // Get previous dates
  const prevDates = dates.map(date => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });

  // Fetch existing assignments
  // MySQL requires placeholders for each item in IN clause
  const allDates = [...dates, ...prevDates];
  const employeePlaceholders = employeeIds.map(() => '?').join(',');
  const datePlaceholders = allDates.map(() => '?').join(',');
  
  const [existing] = await pool.execute(
    `SELECT employee_id, date, shift_pattern_id FROM rotas 
     WHERE employee_id IN (${employeePlaceholders}) AND date IN (${datePlaceholders})`,
    [...employeeIds, ...allDates]
  );

  const existingMap = new Map();
  existing.forEach(r => {
    const key = `${r.employee_id}|${r.date}`;
    const type = patternMap.get(r.shift_pattern_id) || null;
    existingMap.set(key, { date: r.date, type });
  });

  // Validate each assignment
  for (const a of assignments) {
    const type = patternMap.get(a.shift_pattern_id) || null;
    const sameDayKey = `${a.employee_id}|${a.date}`;
    const prevDate = new Date(a.date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDayKey = `${a.employee_id}|${prevDate.toISOString().slice(0, 10)}`;

    // Check for same-day double shift
    if (existingMap.has(sameDayKey)) {
      throw new Error('Guard already has a shift on this date. Same-day double shifts are not allowed.');
    }

    // Check for day shift after night shift (24h rule)
    const prevType = existingMap.get(prevDayKey)?.type || byEmployeeDate.get(prevDayKey)?.shift_pattern_id ? patternMap.get(byEmployeeDate.get(prevDayKey).shift_pattern_id) : null;
    if (type === 'day' && prevType === 'night') {
      throw new Error('Cannot assign a day shift after a night shift to the same guard (24h rule).');
    }
  }
};

// Create rota
router.post('/', authenticateToken, requireManager, [
  body('employee_id').notEmpty(),
  body('date').isISO8601().toDate(),
  body('shift_pattern_id').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employee_id, date, shift_pattern_id, notes } = req.body;
    const normalizedShiftPatternId = shift_pattern_id === 'none' || shift_pattern_id === '' || !shift_pattern_id ? null : shift_pattern_id;

    // Validate assignment
    await validateAssignments([{
      employee_id,
      date: new Date(date).toISOString().slice(0, 10),
      shift_pattern_id: normalizedShiftPatternId
    }]);

    const rotaId = uuidv4();
    await pool.execute(
      `INSERT INTO rotas (id, employee_id, date, shift_pattern_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rotaId, employee_id, date, normalizedShiftPatternId, notes || null, req.user.id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'rota_created', 'rotas', `Created rota for employee ${employee_id} on ${date}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [newRota] = await pool.execute(
      `SELECT r.*, p.full_name as employee_name, 
              sp.name as shift_pattern_name, sp.type as shift_pattern_type, 
              sp.start_time as shift_pattern_start_time, 
              sp.end_time as shift_pattern_end_time, 
              sp.color as shift_pattern_color
       FROM rotas r
       LEFT JOIN profiles p ON r.employee_id = p.id
       LEFT JOIN shift_patterns sp ON r.shift_pattern_id = sp.id
       WHERE r.id = ?`,
      [rotaId]
    );

    res.status(201).json({
      ...newRota[0],
      employee_name: newRota[0].employee_name,
      shift_pattern: newRota[0].shift_pattern_id ? {
        name: newRota[0].shift_pattern_name,
        type: newRota[0].shift_pattern_type,
        start_time: newRota[0].shift_pattern_start_time,
        end_time: newRota[0].shift_pattern_end_time,
        color: newRota[0].shift_pattern_color
      } : null
    });
  } catch (error) {
    console.error('Create rota error:', error);
    res.status(500).json({ error: error.message || 'Failed to create rota' });
  }
});

// Create bulk rotas
router.post('/bulk', authenticateToken, requireManager, async (req, res) => {
  try {
    const { rotas: rotasData } = req.body;

    console.log('Bulk rota request received:', {
      count: rotasData?.length,
      sample: rotasData?.[0]
    });

    if (!Array.isArray(rotasData) || rotasData.length === 0) {
      return res.status(400).json({ error: 'Invalid rotas data' });
    }

    // Normalize and validate
    const normalized = rotasData.map(r => {
      // Ensure date is in correct format
      let dateStr = r.date;
      if (dateStr instanceof Date) {
        dateStr = dateStr.toISOString().slice(0, 10);
      } else if (typeof dateStr === 'string') {
        // Validate date format
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid date format: ${dateStr}`);
        }
        dateStr = dateObj.toISOString().slice(0, 10);
      } else {
        throw new Error(`Invalid date type: ${typeof dateStr}`);
      }

      return {
        employee_id: String(r.employee_id),
        date: dateStr,
        shift_pattern_id: !r.shift_pattern_id || r.shift_pattern_id === 'none' || r.shift_pattern_id === '' ? null : String(r.shift_pattern_id),
        notes: r.notes ? String(r.notes) : null
      };
    });

    console.log('Normalized rotas:', normalized.slice(0, 2));

    await validateAssignments(normalized);

    // Insert all rotas one by one (MySQL doesn't support array binding like PostgreSQL)
    const insertedIds = [];
    for (const r of normalized) {
      const rotaId = uuidv4();
      try {
        // Ensure all parameters are properly formatted
        const params = [
          rotaId,                                    // id
          String(r.employee_id),                    // employee_id
          String(r.date),                            // date (YYYY-MM-DD format)
          r.shift_pattern_id ? String(r.shift_pattern_id) : null,  // shift_pattern_id
          r.notes ? String(r.notes) : null,         // notes
          String(req.user.id)                        // created_by
        ];
        
        console.log('Inserting rota:', {
          id: params[0],
          employee_id: params[1],
          date: params[2],
          shift_pattern_id: params[3],
          notes: params[4]?.substring(0, 20),
          created_by: params[5]
        });
        
        await pool.execute(
          `INSERT INTO rotas (id, employee_id, date, shift_pattern_id, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          params
        );
        insertedIds.push(rotaId);
      } catch (insertError) {
        console.error('Error inserting rota:', insertError);
        console.error('Error details:', {
          message: insertError.message,
          code: insertError.code,
          sqlState: insertError.sqlState,
          sqlMessage: insertError.sqlMessage,
          errno: insertError.errno
        });
        console.error('Failed rota data:', r);
        throw new Error(`Failed to insert rota for date ${r.date}: ${insertError.message}`);
      }
    }

    // Log audit event
    await logAuditEvent(req.user.id, 'rotas_bulk_created', 'rotas', `Created ${normalized.length} rotas`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    res.status(201).json({ message: `${normalized.length} rotas created successfully` });
  } catch (error) {
    console.error('Create bulk rotas error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Failed to create bulk rotas',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update rota
router.put('/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const { employee_id, date, shift_pattern_id, notes, is_locked } = req.body;

    const updates = {};
    if (employee_id !== undefined) updates.employee_id = employee_id;
    if (date !== undefined) updates.date = date;
    if (shift_pattern_id !== undefined) {
      updates.shift_pattern_id = shift_pattern_id === 'none' || shift_pattern_id === '' ? null : shift_pattern_id;
    }
    if (notes !== undefined) updates.notes = notes;
    if (is_locked !== undefined) updates.is_locked = is_locked;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // If updating employee_id or date, validate
    if (updates.employee_id || updates.date) {
      const [existing] = await pool.execute('SELECT employee_id, date, shift_pattern_id FROM rotas WHERE id = ?', [req.params.id]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Rota not found' });
      }
      const current = existing[0];
      await validateAssignments([{
        employee_id: updates.employee_id || current.employee_id,
        date: updates.date || current.date,
        shift_pattern_id: updates.shift_pattern_id !== undefined ? updates.shift_pattern_id : current.shift_pattern_id
      }]);
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await pool.execute(
      `UPDATE rotas SET ${setClause} WHERE id = ?`,
      values
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'rota_updated', 'rotas', `Updated rota: ${req.params.id}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT r.*, p.full_name as employee_name, 
              sp.name as shift_pattern_name, sp.type as shift_pattern_type, 
              sp.start_time as shift_pattern_start_time, 
              sp.end_time as shift_pattern_end_time, 
              sp.color as shift_pattern_color
       FROM rotas r
       LEFT JOIN profiles p ON r.employee_id = p.id
       LEFT JOIN shift_patterns sp ON r.shift_pattern_id = sp.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    res.json({
      ...updated[0],
      employee_name: updated[0].employee_name,
      shift_pattern: updated[0].shift_pattern_id ? {
        name: updated[0].shift_pattern_name,
        type: updated[0].shift_pattern_type,
        start_time: updated[0].shift_pattern_start_time,
        end_time: updated[0].shift_pattern_end_time,
        color: updated[0].shift_pattern_color
      } : null
    });
  } catch (error) {
    console.error('Update rota error:', error);
    res.status(500).json({ error: error.message || 'Failed to update rota' });
  }
});

// Delete rota
router.delete('/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    await pool.execute('DELETE FROM rotas WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'rota_deleted', 'rotas', `Deleted rota: ${req.params.id}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Rota deleted successfully' });
  } catch (error) {
    console.error('Delete rota error:', error);
    res.status(500).json({ error: 'Failed to delete rota' });
  }
});

// Clear all rotas (admin only)
router.delete('/', authenticateToken, requireManager, async (req, res) => {
  try {
    await pool.execute('DELETE FROM rotas');

    // Log audit event
    await logAuditEvent(req.user.id, 'rotas_cleared', 'rotas', 'Cleared all rotas', 'high', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'All rotas cleared successfully' });
  } catch (error) {
    console.error('Clear rotas error:', error);
    res.status(500).json({ error: 'Failed to clear rotas' });
  }
});

// Get shift patterns
router.get('/shift-patterns/list', authenticateToken, async (req, res) => {
  try {
    const [patterns] = await pool.execute(
      'SELECT * FROM shift_patterns ORDER BY name ASC'
    );
    res.json(patterns);
  } catch (error) {
    console.error('Get shift patterns error:', error);
    res.status(500).json({ error: 'Failed to fetch shift patterns' });
  }
});

// Create shift pattern
router.post('/shift-patterns', authenticateToken, requireManager, [
  body('name').trim().notEmpty(),
  body('type').isIn(['day', 'night', 'off']),
  body('color').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, type, start_time, end_time, color, description } = req.body;
    const patternId = uuidv4();

    await pool.execute(
      `INSERT INTO shift_patterns (id, name, type, start_time, end_time, color, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [patternId, name, type, start_time || null, end_time || null, color || '#3b82f6', description || null]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'shift_pattern_created', 'shift_patterns', `Created shift pattern: ${name}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [newPattern] = await pool.execute(
      'SELECT * FROM shift_patterns WHERE id = ?',
      [patternId]
    );

    res.status(201).json(newPattern[0]);
  } catch (error) {
    console.error('Create shift pattern error:', error);
    res.status(500).json({ error: 'Failed to create shift pattern' });
  }
});

// Delete shift pattern
router.delete('/shift-patterns/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const patternId = req.params.id;

    // Check if pattern exists
    const [patterns] = await pool.execute(
      'SELECT * FROM shift_patterns WHERE id = ?',
      [patternId]
    );

    if (patterns.length === 0) {
      return res.status(404).json({ error: 'Shift pattern not found' });
    }

    const pattern = patterns[0];

    // Check if pattern is in use (has rotas assigned to it)
    const [rotasUsingPattern] = await pool.execute(
      'SELECT COUNT(*) as count FROM rotas WHERE shift_pattern_id = ?',
      [patternId]
    );

    const usageCount = rotasUsingPattern[0].count;

    if (usageCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete shift pattern "${pattern.name}" because it is currently assigned to ${usageCount} shift(s). Please remove all assignments before deleting.` 
      });
    }

    // Delete the pattern
    await pool.execute(
      'DELETE FROM shift_patterns WHERE id = ?',
      [patternId]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'shift_pattern_deleted', 'shift_patterns', `Deleted shift pattern: ${pattern.name}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Shift pattern deleted successfully' });
  } catch (error) {
    console.error('Delete shift pattern error:', error);
    res.status(500).json({ error: 'Failed to delete shift pattern' });
  }
});

// Generate PDF for monthly rota
router.get('/pdf/monthly', authenticateToken, requireManager, async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    // Get start and end dates for the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    // Fetch all rotas for the month
    const [rotas] = await pool.execute(
      `SELECT r.*, p.full_name as employee_name, 
              sp.name as shift_pattern_name, sp.type as shift_pattern_type, 
              sp.start_time as shift_pattern_start_time, 
              sp.end_time as shift_pattern_end_time, 
              sp.color as shift_pattern_color
       FROM rotas r
       LEFT JOIN profiles p ON r.employee_id = p.id
       LEFT JOIN shift_patterns sp ON r.shift_pattern_id = sp.id
       WHERE r.date >= ? AND r.date <= ?
       ORDER BY r.date ASC, p.full_name ASC`,
      [startDateStr, endDateStr]
    );

    // Fetch all employees to get summary
    const [allEmployees] = await pool.execute(
      `SELECT DISTINCT p.id, p.full_name
       FROM profiles p
       INNER JOIN rotas r ON p.id = r.employee_id
       WHERE r.date >= ? AND r.date <= ?
       ORDER BY p.full_name ASC`,
      [startDateStr, endDateStr]
    );

    // Organize rotas by date and shift type
    const rotaByDate = {};
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    rotas.forEach(rota => {
      const dateStr = rota.date instanceof Date 
        ? rota.date.toISOString().slice(0, 10) 
        : rota.date.split('T')[0];
      
      if (!rotaByDate[dateStr]) {
        rotaByDate[dateStr] = { morning: [], night: [] };
      }
      
      const shiftType = rota.shift_pattern_type;
      if (shiftType === 'day') {
        rotaByDate[dateStr].morning.push(rota.employee_name);
      } else if (shiftType === 'night') {
        rotaByDate[dateStr].night.push(rota.employee_name);
      }
    });

    // Calculate summary for each employee
    const employeeSummary = {};
    allEmployees.forEach(emp => {
      employeeSummary[emp.id] = {
        name: emp.full_name,
        dayShifts: 0,
        nightShifts: 0,
        total: 0
      };
    });

    rotas.forEach(rota => {
      const empId = rota.employee_id;
      if (employeeSummary[empId]) {
        if (rota.shift_pattern_type === 'day') {
          employeeSummary[empId].dayShifts++;
          employeeSummary[empId].total++;
        } else if (rota.shift_pattern_type === 'night') {
          employeeSummary[empId].nightShifts++;
          employeeSummary[empId].total++;
        }
      }
    });

    // Create PDF
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      layout: 'landscape'
    });

    // Set response headers including CORS
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rota-${monthNames[monthNum-1]}-${yearNum}.pdf"`);
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Pipe PDF to response
    doc.pipe(res);

    // Header with logo area (top left)
    const logoSize = 60;
    const logoX = 50;
    const logoY = 50;
    
    // Draw a simple shield/logo placeholder
    doc.rect(logoX, logoY, logoSize, logoSize).stroke();
    doc.fontSize(8).text('LOGO', logoX + logoSize/2, logoY + logoSize/2 - 4, { align: 'center' });
    
    // Company name and title
    doc.fontSize(18).font('Helvetica-Bold').text('DELTA WATCH SECURITY', logoX + logoSize + 10, logoY + 5);
    doc.fontSize(14).font('Helvetica').text(`DWS Control - ${monthNames[monthNum-1]} ${yearNum}`, logoX + logoSize + 10, logoY + 25);

    // Calculate table dimensions
    const tableStartY = 130;
    const rowHeight = 18;
    const colWidth = 70;
    const dateColWidth = 90;
    const firstColX = 50;
    let currentY = tableStartY;

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(firstColX, currentY, dateColWidth, rowHeight).stroke();
    doc.text('Date', firstColX + 5, currentY + 5);
    
    doc.rect(firstColX + dateColWidth, currentY, colWidth * 2, rowHeight).stroke();
    doc.text('Morning (7AM to 7PM)', firstColX + dateColWidth + 5, currentY + 5);
    
    doc.rect(firstColX + dateColWidth + colWidth * 2, currentY, colWidth * 2, rowHeight).stroke();
    doc.text('Night (7PM to 7AM)', firstColX + dateColWidth + colWidth * 2 + 5, currentY + 5);
    
    currentY += rowHeight;

    // Generate all dates in the month
    const daysInMonth = endDate.getDate();
    doc.fontSize(8).font('Helvetica');
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(yearNum, monthNum - 1, day);
      const dateStr = currentDate.toISOString().slice(0, 10);
      const dayName = dayNames[currentDate.getDay()];
      const dateLabel = `${String(day).padStart(2, '0')}-${String(monthNum).padStart(2, '0')} (${dayName})`;
      
      const rotaData = rotaByDate[dateStr] || { morning: [], night: [] };
      
      // Check if we need a new page
      if (currentY + rowHeight > 500) {
        doc.addPage();
        currentY = 50;
        // Redraw header on new page
        doc.fontSize(10).font('Helvetica-Bold');
        doc.rect(firstColX, currentY, dateColWidth, rowHeight).stroke();
        doc.text('Date', firstColX + 5, currentY + 5);
        doc.rect(firstColX + dateColWidth, currentY, colWidth * 2, rowHeight).stroke();
        doc.text('Morning (7AM to 7PM)', firstColX + dateColWidth + 5, currentY + 5);
        doc.rect(firstColX + dateColWidth + colWidth * 2, currentY, colWidth * 2, rowHeight).stroke();
        doc.text('Night (7PM to 7AM)', firstColX + dateColWidth + colWidth * 2 + 5, currentY + 5);
        currentY += rowHeight;
        doc.fontSize(8).font('Helvetica');
      }

      // Date cell
      doc.rect(firstColX, currentY, dateColWidth, rowHeight).stroke();
      doc.text(dateLabel, firstColX + 5, currentY + 5);
      
      // Morning shift cell
      doc.rect(firstColX + dateColWidth, currentY, colWidth * 2, rowHeight).stroke();
      doc.text(rotaData.morning.join(', ') || '-', firstColX + dateColWidth + 5, currentY + 5, {
        width: colWidth * 2 - 10,
        ellipsis: true
      });
      
      // Night shift cell
      doc.rect(firstColX + dateColWidth + colWidth * 2, currentY, colWidth * 2, rowHeight).stroke();
      doc.text(rotaData.night.join(', ') || '-', firstColX + dateColWidth + colWidth * 2 + 5, currentY + 5, {
        width: colWidth * 2 - 10,
        ellipsis: true
      });
      
      currentY += rowHeight;
    }

    // Summary table on the right side
    const summaryStartX = firstColX + dateColWidth + colWidth * 4 + 30;
    const summaryStartY = tableStartY;
    const summaryColWidth = 60;
    
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Summary', summaryStartX, summaryStartY - 20);
    
    // Summary header
    doc.rect(summaryStartX, summaryStartY, summaryColWidth, rowHeight).stroke();
    doc.text('Name', summaryStartX + 5, summaryStartY + 5);
    
    doc.rect(summaryStartX + summaryColWidth, summaryStartY, summaryColWidth * 0.6, rowHeight).stroke();
    doc.text('Day', summaryStartX + summaryColWidth + 5, summaryStartY + 5);
    
    doc.rect(summaryStartX + summaryColWidth * 1.6, summaryStartY, summaryColWidth * 0.6, rowHeight).stroke();
    doc.text('Night', summaryStartX + summaryColWidth * 1.6 + 5, summaryStartY + 5);
    
    doc.rect(summaryStartX + summaryColWidth * 2.2, summaryStartY, summaryColWidth * 0.6, rowHeight).stroke();
    doc.text('Total', summaryStartX + summaryColWidth * 2.2 + 5, summaryStartY + 5);
    
    let summaryY = summaryStartY + rowHeight;
    doc.fontSize(8).font('Helvetica');
    
    Object.values(employeeSummary).forEach(emp => {
      if (summaryY + rowHeight > 700) {
        // Summary continues on next page if needed
        summaryY = 50;
      }
      
      doc.rect(summaryStartX, summaryY, summaryColWidth, rowHeight).stroke();
      doc.text(emp.name, summaryStartX + 5, summaryY + 5, {
        width: summaryColWidth - 10,
        ellipsis: true
      });
      
      doc.rect(summaryStartX + summaryColWidth, summaryY, summaryColWidth * 0.6, rowHeight).stroke();
      doc.text(emp.dayShifts.toString(), summaryStartX + summaryColWidth + 5, summaryY + 5);
      
      doc.rect(summaryStartX + summaryColWidth * 1.6, summaryY, summaryColWidth * 0.6, rowHeight).stroke();
      doc.text(emp.nightShifts.toString(), summaryStartX + summaryColWidth * 1.6 + 5, summaryY + 5);
      
      doc.rect(summaryStartX + summaryColWidth * 2.2, summaryY, summaryColWidth * 0.6, rowHeight).stroke();
      doc.text(emp.total.toString(), summaryStartX + summaryColWidth * 2.2 + 5, summaryY + 5);
      
      summaryY += rowHeight;
    });

    // Log audit event
    await logAuditEvent(req.user.id, 'rota_pdf_generated', 'rotas', `Generated PDF for ${monthNames[monthNum-1]} ${yearNum}`, 'low', 'system_access', req.ip, req.get('user-agent'));

    doc.end();
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
