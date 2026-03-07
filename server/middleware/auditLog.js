import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Helper function to normalize IP address (prefer IPv4, convert IPv6 loopback)
const normalizeIpAddress = (ip) => {
  if (!ip) return null;
  
  // Convert IPv6 loopback to IPv4
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }
  
  // Handle IPv4-mapped IPv6 addresses (::ffff:127.0.0.1 -> 127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  
  return ip;
};

export const logAuditEvent = async (
  userId,
  action,
  resource,
  details = null,
  severity = 'low',
  category = 'system_access',
  ipAddress = null,
  userAgent = null
) => {
  try {
    const logId = uuidv4();
    
    // Validate required fields
    if (!action) {
      console.error('Audit log error: action is required', { action });
      return;
    }

    // Verify user_id exists (it's required in the actual table)
    let validUserId = userId;
    if (!userId) {
      console.warn('Audit log warning: user_id is required but not provided. Skipping audit log.');
      return;
    }

    try {
      const [users] = await pool.execute(
        'SELECT id FROM profiles WHERE id = ?',
        [userId]
      );
      if (users.length === 0) {
        console.warn(`Audit log warning: user_id ${userId} does not exist in profiles table. Skipping audit log.`);
        return;
      }
    } catch (checkError) {
      console.warn('Could not verify user_id, skipping audit log:', checkError.message);
      return;
    }

    // Map resource to table_name (the actual column name in the database)
    const tableName = resource || null;
    
    // Store details in new_values as JSON
    const newValues = details ? JSON.stringify({ details, severity, category }) : null;

    // Log the attempt (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Logging audit event:', {
        id: logId,
        userId: validUserId,
        action,
        table_name: tableName
      });
    }

    // Normalize IP address for better readability
    const normalizedIp = normalizeIpAddress(ipAddress);

    const result = await pool.execute(
      `INSERT INTO audit_log (id, user_id, action, table_name, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [logId, validUserId, action, tableName, newValues, normalizedIp, userAgent || null]
    );

    if (process.env.NODE_ENV === 'development') {
      console.log('Audit event logged successfully:', logId);
    }
  } catch (error) {
    // Don't throw - we don't want audit logging failures to break the main flow
    // But log detailed error information
    console.error('Failed to log audit event:', {
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      userId,
      action,
      resource
    });
    
    // Handle specific error cases
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42S02') {
      console.error('❌ CRITICAL: audit_log table does not exist! Please run the database schema.');
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === '1452') {
      console.error('❌ Foreign key constraint violation: user_id does not exist in profiles table');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('❌ Column mismatch: audit_log table structure does not match expected schema');
    }
  }
};

export const auditMiddleware = (action, resource, severity = 'low', category = 'system_access') => {
  return async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
      // Log after response is sent
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');
      const userId = req.user?.id || null;
      
      logAuditEvent(userId, action, resource, JSON.stringify(req.body), severity, category, ipAddress, userAgent);
      
      return originalSend.call(this, data);
    };
    next();
  };
};
