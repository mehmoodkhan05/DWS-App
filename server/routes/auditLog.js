import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get audit logs (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    let query = `
      SELECT al.*, p.full_name as user_name, p.email as user_email
      FROM audit_log al
      LEFT JOIN profiles p ON al.user_id = p.id
      WHERE 1=1
    `;

    let params = [];

    query += ' ORDER BY al.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [logs] = await pool.execute(query, params);

    // Parse JSON fields and map to expected format
    const formattedLogs = logs.map(log => {
      let parsedNewValues = null;
      let parsedOldValues = null;
      let severity = 'low';
      let category = 'system_access';
      let details = null;

      try {
        if (log.new_values) {
          parsedNewValues = JSON.parse(log.new_values);
          severity = parsedNewValues.severity || 'low';
          category = parsedNewValues.category || 'system_access';
          details = parsedNewValues.details || null;
        }
        if (log.old_values) {
          parsedOldValues = JSON.parse(log.old_values);
        }
      } catch (e) {
        // If parsing fails, use raw values
        details = log.new_values;
      }

      return {
        ...log,
        resource: log.table_name || 'unknown',
        details: details,
        severity: severity,
        category: category,
        old_values: parsedOldValues,
        new_values: parsedNewValues
      };
    });

    res.json(formattedLogs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get single audit log entry
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT al.*, p.full_name as user_name, p.email as user_email
       FROM audit_log al
       LEFT JOIN profiles p ON al.user_id = p.id
       WHERE al.id = ?`,
      [req.params.id]
    );

    if (logs.length === 0) {
      return res.status(404).json({ error: 'Audit log entry not found' });
    }

    res.json(logs[0]);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
