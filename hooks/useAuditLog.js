import { useState, useEffect } from 'react';
import { auditLogAPI } from '../lib/api';

export const useAuditLog = () => {
  const [auditEntries, setAuditEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAuditLogs = async (severity, category, limit) => {
    try {
      setLoading(true);
      setError(null);
      const data = await auditLogAPI.getAll(severity, category, limit);
      console.log('Fetched audit logs:', data.length, 'entries');
      setAuditEntries(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to fetch audit logs');
      setAuditEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const logAuditEvent = async (
    action,
    resource,
    details,
    severity = 'low',
    category = 'system_access'
  ) => {
    // Audit logging is handled by the backend middleware
    console.log('Audit event:', { action, resource, details, severity, category });
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return {
    auditEntries,
    loading,
    error,
    logAuditEvent,
    refetch: fetchAuditLogs
  };
};
