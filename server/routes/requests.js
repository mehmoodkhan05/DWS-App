import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all requests
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Employees can only see their own requests, managers/admins see all
    let query = `
      SELECT r.*, 
             p1.full_name as employee_name,
             p2.full_name as approver_name
      FROM requests r
      LEFT JOIN profiles p1 ON r.employee_id = p1.id
      LEFT JOIN profiles p2 ON r.approved_by = p2.id
    `;

    let params = [];
    if (req.user.role === 'employee') {
      query += ' WHERE r.employee_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY r.created_at DESC';

    const [requests] = await pool.execute(query, params);

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get single request
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT r.*, 
              p1.full_name as employee_name,
              p2.full_name as approver_name
       FROM requests r
       LEFT JOIN profiles p1 ON r.employee_id = p1.id
       LEFT JOIN profiles p2 ON r.approved_by = p2.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requests[0];
    
    // Employees can only view their own requests
    if (req.user.role === 'employee' && request.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(request);
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Create request
router.post('/', authenticateToken, [
  body('type').isIn(['leave', 'shift_swap', 'overtime']),
  body('start_date').isISO8601().toDate(),
  body('end_date').optional().isISO8601().toDate(),
  body('reason').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, start_date, end_date, reason } = req.body;
    const requestId = uuidv4();

    await pool.execute(
      `INSERT INTO requests (id, employee_id, type, status, start_date, end_date, reason)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      [requestId, req.user.id, type, start_date, end_date || null, reason]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'request_created', 'requests', `Created ${type} request`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    const [newRequest] = await pool.execute(
      `SELECT r.*, 
              p1.full_name as employee_name,
              p2.full_name as approver_name
       FROM requests r
       LEFT JOIN profiles p1 ON r.employee_id = p1.id
       LEFT JOIN profiles p2 ON r.approved_by = p2.id
       WHERE r.id = ?`,
      [requestId]
    );

    res.status(201).json(newRequest[0]);
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Update request status (approve/reject)
router.patch('/:id/status', authenticateToken, requireManager, [
  body('status').isIn(['approved', 'rejected']),
  body('admin_notes').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, admin_notes } = req.body;

    // Get the request
    const [requests] = await pool.execute(
      'SELECT * FROM requests WHERE id = ?',
      [req.params.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requests[0];
    
    // Normalize dates from database (MySQL2 returns DATE as Date objects)
    // This prevents timezone issues when comparing dates
    if (request.start_date instanceof Date) {
      const d = request.start_date;
      request.start_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (typeof request.start_date === 'string' && request.start_date.includes('T')) {
      // Handle ISO string dates
      request.start_date = request.start_date.split('T')[0];
    }
    
    if (request.end_date instanceof Date) {
      const d = request.end_date;
      request.end_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (request.end_date && typeof request.end_date === 'string' && request.end_date.includes('T')) {
      // Handle ISO string dates
      request.end_date = request.end_date.split('T')[0];
    }

    // If approving, perform the swap/leave operation FIRST before updating status
    // This ensures the request is only approved if the operation succeeds
    if (status === 'approved') {
      // If approving a shift swap, perform the swap first
      if (request.type === 'shift_swap') {
        try {
          await performShiftSwap(request);
          // Log successful swap
          await logAuditEvent(req.user.id, 'shift_swap_completed', 'rotas', `Automatically swapped shifts for request ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));
        } catch (swapError) {
          console.error('❌ Shift swap error:', swapError);
          console.error('Error details:', {
            requestId: req.params.id,
            requesterId: request.employee_id,
            startDate: request.start_date,
            endDate: request.end_date,
            startDateType: typeof request.start_date,
            endDateType: typeof request.end_date,
            errorMessage: swapError.message,
            errorName: swapError.name,
            errorStack: swapError.stack
          });
          
          // Log the swap failure
          try {
            await logAuditEvent(req.user.id, 'shift_swap_failed', 'rotas', `Failed to automatically swap shifts for request ${req.params.id}: ${swapError.message}`, 'high', 'system_error', req.ip, req.get('user-agent'));
          } catch (logError) {
            console.error('Failed to log audit event:', logError);
          }
          
          // Return error - do NOT approve the request
          return res.status(400).json({ 
            error: 'Cannot approve swap request', 
            details: swapError.message || 'Unknown error occurred',
            message: 'The shift swap could not be completed. Please verify that both employees have shifts on the specified dates and try again.'
          });
        }
      }

      // If approving a leave request, mark employee as off first
      if (request.type === 'leave') {
        try {
          await markEmployeeOnLeave(request, req.user.id);
          // Log successful leave marking
          await logAuditEvent(req.user.id, 'leave_approved_rota_updated', 'rotas', `Automatically marked employee ${request.employee_id} as off for leave period (${request.start_date}${request.end_date ? ' to ' + request.end_date : ''})`, 'medium', 'data_modification', req.ip, req.get('user-agent'));
        } catch (leaveError) {
          console.error('Leave marking error:', leaveError);
          // Log the leave marking failure
          await logAuditEvent(req.user.id, 'leave_approved_rota_failed', 'rotas', `Failed to automatically mark employee as off for leave request ${req.params.id}: ${leaveError.message}`, 'high', 'system_error', req.ip, req.get('user-agent'));
          // Return error - do NOT approve the request
          return res.status(400).json({ 
            error: 'Cannot approve leave request', 
            details: leaveError.message,
            message: 'The leave could not be marked in the rota. Please check the dates and try again.'
          });
        }
      }
    }
    
    // Only update request status if swap/leave operation succeeded (or if rejecting)
    const updateData = [status, admin_notes || null, req.user.id, req.params.id];
    await pool.execute(
      `UPDATE requests 
       SET status = ?, admin_notes = ?, approved_by = ?, approved_at = NOW()
       WHERE id = ?`,
      updateData
    );
    
    // If rejecting, do nothing - the swap/leave is simply not performed

    // Log audit event
    await logAuditEvent(req.user.id, 'request_status_updated', 'requests', `${status} request: ${req.params.id}`, 'medium', 'data_modification', req.ip, req.get('user-agent'));

    const [updated] = await pool.execute(
      `SELECT r.*, 
              p1.full_name as employee_name,
              p2.full_name as approver_name
       FROM requests r
       LEFT JOIN profiles p1 ON r.employee_id = p1.id
       LEFT JOIN profiles p2 ON r.approved_by = p2.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({ error: 'Failed to update request status' });
  }
});

// Helper function to mark employee as off for leave period
const markEmployeeOnLeave = async (request, approvedBy) => {
  const startDate = new Date(request.start_date);
  const endDate = request.end_date ? new Date(request.end_date) : new Date(request.start_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format in leave request');
  }

  if (endDate < startDate) {
    throw new Error('End date cannot be before start date');
  }

  // Find or get the "Off Day" shift pattern
  let offDayPatternId = null;
  const [offDayPatterns] = await pool.execute(
    "SELECT id FROM shift_patterns WHERE type = 'off' AND name LIKE '%Off%' LIMIT 1"
  );

  if (offDayPatterns.length > 0) {
    offDayPatternId = offDayPatterns[0].id;
  }

  // Generate all dates in the leave period
  // Use local date methods to avoid timezone issues
  const dates = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Use local date methods instead of toISOString() to prevent timezone shifts
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Process each date
  for (const date of dates) {
    // Check if rota entry already exists for this employee and date
    const [existingRotas] = await pool.execute(
      'SELECT id, shift_pattern_id FROM rotas WHERE employee_id = ? AND date = ?',
      [request.employee_id, date]
    );

    if (existingRotas.length > 0) {
      // Update existing rota entry to mark as off
      const existingRota = existingRotas[0];
      await pool.execute(
        'UPDATE rotas SET shift_pattern_id = ? WHERE id = ?',
        [offDayPatternId, existingRota.id]
      );
    } else {
      // Create new rota entry marked as off
      const rotaId = uuidv4();
      await pool.execute(
        `INSERT INTO rotas (id, employee_id, date, shift_pattern_id, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          rotaId,
          request.employee_id,
          date,
          offDayPatternId,
          `Leave: ${request.reason.substring(0, 100)}`, // Store reason in notes (truncated)
          approvedBy || null
        ]
      );
    }
  }

  console.log(`Leave marked: Employee ${request.employee_id} marked as off for ${dates.length} day(s) (${dates[0]}${dates.length > 1 ? ' to ' + dates[dates.length - 1] : ''})`);
};

// Helper function to perform shift swap
const performShiftSwap = async (request) => {
  // Normalize dates to YYYY-MM-DD format (timezone-safe)
  const normalizeDate = (date) => {
    if (!date) return null;
    
    // If it's already a string in YYYY-MM-DD format, return it
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // Handle Date objects (MySQL2 returns DATE as Date objects)
    let d;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      // Handle date strings - parse as local date to avoid timezone issues
      // If it's in YYYY-MM-DD format, parse it carefully
      if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
        const parts = date.split('T')[0].split('-');
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        d = new Date(date);
      }
    } else {
      d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date format: ${date} (type: ${typeof date})`);
    }
    
    // Use local date methods to avoid timezone issues
    // This ensures we get the date as it was stored, not converted to UTC
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Use start_date as requester's shift date and end_date as swap partner's shift date
  const requesterDate = normalizeDate(request.start_date);
  const swapPartnerDate = normalizeDate(request.end_date);

  if (!requesterDate || !swapPartnerDate) {
    throw new Error('Swap request missing required date information');
  }

  // Debug logging
  console.log('🔍 Swap Debug Info:', {
    requestId: request.id,
    requesterId: request.employee_id,
    originalStartDate: request.start_date,
    originalStartDateType: typeof request.start_date,
    originalStartDateIsDate: request.start_date instanceof Date,
    normalizedRequesterDate: requesterDate,
    originalEndDate: request.end_date,
    originalEndDateType: typeof request.end_date,
    originalEndDateIsDate: request.end_date instanceof Date,
    normalizedSwapPartnerDate: swapPartnerDate
  });

  // Parse swap partner employee ID from reason field
  // New format: "SWAP_PARTNER_ID:[employee_id]|Swap my shift on..."
  let swapWithEmployeeId = null;

  // First, try to extract employee_id from structured format
  const idMatch = request.reason.match(/SWAP_PARTNER_ID:([^|]+)\|/);
  if (idMatch && idMatch[1]) {
    swapWithEmployeeId = idMatch[1].trim();
    
    // Verify the employee exists and is active
    const [profiles] = await pool.execute(
      'SELECT id FROM profiles WHERE id = ? AND is_active = 1',
      [swapWithEmployeeId]
    );

    if (profiles.length === 0) {
      console.warn(`Swap partner employee ID ${swapWithEmployeeId} not found or inactive, trying fallback method`);
      swapWithEmployeeId = null;
    }
  }

  // Fallback: Try to extract employee name from reason field
  if (!swapWithEmployeeId) {
    const nameMatch = request.reason.match(/with ([^']+)'s shift on/);
    if (nameMatch && nameMatch[1]) {
      const swapWithEmployeeName = nameMatch[1].trim();
      
      // Find the employee by name
      const [profiles] = await pool.execute(
        'SELECT id, full_name FROM profiles WHERE full_name = ? AND is_active = 1',
        [swapWithEmployeeName]
      );

      if (profiles.length > 0) {
        swapWithEmployeeId = profiles[0].id;
      }
    }
  }

  // Last resort: Find employee who has a shift on swapPartnerDate (excluding requester)
  if (!swapWithEmployeeId) {
    const [shiftsOnSwapDate] = await pool.execute(
      'SELECT employee_id FROM rotas WHERE date = ? AND employee_id != ? LIMIT 1',
      [swapPartnerDate, request.employee_id]
    );

    if (shiftsOnSwapDate.length > 0) {
      swapWithEmployeeId = shiftsOnSwapDate[0].employee_id;
      console.warn(`Using fallback method to identify swap partner: ${swapWithEmployeeId}`);
    }
  }

  if (!swapWithEmployeeId) {
    throw new Error(`Could not identify swap partner employee. Please ensure the swap request is valid.`);
  }

  console.log('🔍 Swap Partner Info:', {
    swapPartnerId: swapWithEmployeeId,
    swapPartnerDate: swapPartnerDate,
    requesterId: request.employee_id,
    requesterDate: requesterDate
  });

  // Get the requester's shift on their date
  const [requesterShifts] = await pool.execute(
    'SELECT * FROM rotas WHERE employee_id = ? AND date = ?',
    [request.employee_id, requesterDate]
  );

  console.log('🔍 Requester Shifts Query:', {
    employeeId: request.employee_id,
    date: requesterDate,
    foundShifts: requesterShifts.length,
    shifts: requesterShifts.map(s => ({ id: s.id, date: s.date, employee_id: s.employee_id }))
  });

  // Get the swap partner's shift on their date
  const [swapPartnerShifts] = await pool.execute(
    'SELECT * FROM rotas WHERE employee_id = ? AND date = ?',
    [swapWithEmployeeId, swapPartnerDate]
  );

  console.log('🔍 Swap Partner Shifts Query:', {
    employeeId: swapWithEmployeeId,
    date: swapPartnerDate,
    foundShifts: swapPartnerShifts.length,
    shifts: swapPartnerShifts.map(s => ({ id: s.id, date: s.date, employee_id: s.employee_id }))
  });

  // Debug: Check all shifts on that date to see what's available
  const [allShiftsOnDate] = await pool.execute(
    'SELECT employee_id, date, id FROM rotas WHERE date = ?',
    [swapPartnerDate]
  );
  console.log('🔍 All shifts on swap partner date:', {
    date: swapPartnerDate,
    totalShifts: allShiftsOnDate.length,
    shifts: allShiftsOnDate.map(s => ({ employee_id: s.employee_id, date: s.date, id: s.id }))
  });

  if (requesterShifts.length === 0) {
    throw new Error(`Requester does not have a shift on ${requesterDate}`);
  }

  if (swapPartnerShifts.length === 0) {
    throw new Error(`Swap partner does not have a shift on ${swapPartnerDate}. Found ${allShiftsOnDate.length} shift(s) on that date, but none for employee ${swapWithEmployeeId}`);
  }

  const requesterShift = requesterShifts[0];
  const swapPartnerShift = swapPartnerShifts[0];

  // Check if swap partner already has a shift on requester's date (conflict check)
  const [existingOnRequesterDate] = await pool.execute(
    'SELECT id FROM rotas WHERE employee_id = ? AND date = ? AND id != ?',
    [swapWithEmployeeId, requesterDate, requesterShift.id]
  );

  // Check if requester already has a shift on swap partner's date (conflict check)
  const [existingOnSwapPartnerDate] = await pool.execute(
    'SELECT id FROM rotas WHERE employee_id = ? AND date = ? AND id != ?',
    [request.employee_id, swapPartnerDate, swapPartnerShift.id]
  );

  // Perform the swap using a transaction-like approach with temporary date
  const tempDate = '2099-12-31';
  const conflictingShiftOnRequesterDate = existingOnRequesterDate.length > 0 ? existingOnRequesterDate[0].id : null;
  const conflictingShiftOnSwapPartnerDate = existingOnSwapPartnerDate.length > 0 ? existingOnSwapPartnerDate[0].id : null;

  try {
    // Step 1: If swap partner already has a conflicting shift on requester's date, delete it first
    // This handles the case where the swap partner might have been assigned to the requester's date
    if (conflictingShiftOnRequesterDate) {
      await pool.execute(
        'DELETE FROM rotas WHERE id = ?',
        [conflictingShiftOnRequesterDate]
      );
    }

    // Step 2: If requester already has a conflicting shift on swap partner's date, move it to temp date
    if (conflictingShiftOnSwapPartnerDate) {
      await pool.execute(
        'UPDATE rotas SET date = ? WHERE id = ?',
        [tempDate, conflictingShiftOnSwapPartnerDate]
      );
    }

    // Step 3: Temporarily move requester's shift to temp date to avoid unique constraint
    await pool.execute(
      'UPDATE rotas SET date = ? WHERE id = ?',
      [tempDate, requesterShift.id]
    );

    // Step 4: Assign swap partner's shift to requester (on swap partner's original date)
    await pool.execute(
      'UPDATE rotas SET employee_id = ? WHERE id = ?',
      [request.employee_id, swapPartnerShift.id]
    );

    // Step 5: Assign requester's shift to swap partner (on requester's original date)
    // At this point, requesterDate should be free for swap partner
    await pool.execute(
      'UPDATE rotas SET employee_id = ?, date = ? WHERE id = ?',
      [swapWithEmployeeId, requesterDate, requesterShift.id]
    );

    console.log(`Shift swap completed: Employee ${request.employee_id} swapped shift on ${requesterDate} with employee ${swapWithEmployeeId} on ${swapPartnerDate}`);
  } catch (error) {
    // Rollback: restore shifts to original state
    try {
      // Restore requester's shift
      await pool.execute('UPDATE rotas SET date = ? WHERE id = ?', [requesterDate, requesterShift.id]);
      
      // Restore swap partner's shift
      await pool.execute('UPDATE rotas SET employee_id = ? WHERE id = ?', [swapWithEmployeeId, swapPartnerShift.id]);
      
      // Restore conflicting shift on swap partner's date if it was moved
      if (conflictingShiftOnSwapPartnerDate) {
        await pool.execute('UPDATE rotas SET date = ? WHERE id = ?', [swapPartnerDate, conflictingShiftOnSwapPartnerDate]);
      }
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    throw error;
  }
};

// Delete request
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Get the request
    const [requests] = await pool.execute(
      'SELECT employee_id FROM requests WHERE id = ?',
      [req.params.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Employees can only delete their own requests, managers/admins can delete any
    if (req.user.role === 'employee' && requests[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute('DELETE FROM requests WHERE id = ?', [req.params.id]);

    // Log audit event
    await logAuditEvent(req.user.id, 'request_deleted', 'requests', `Deleted request: ${req.params.id}`, 'low', 'data_modification', req.ip, req.get('user-agent'));

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

export default router;
