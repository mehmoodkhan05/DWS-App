import { useState, useEffect } from 'react';
import { salariesAPI } from '../lib/api';

export const useSalaries = (employeeId) => {
  const [salaries, setSalaries] = useState([]);
  const [currentSalary, setCurrentSalary] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const data = await salariesAPI.getAll();
      setSalaries(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSalary = async (empId) => {
    try {
      const data = await salariesAPI.getCurrent(empId);
      setCurrentSalary(data);
      return data;
    } catch (err) {
      // 404 = no active salary found — not a fatal error, just show empty state
      if (err?.response?.status !== 404 && !err?.message?.includes('No active salary')) {
        console.error('Error fetching current salary:', err.message);
      }
      setCurrentSalary(null);
      return null;
    }
  };

  const fetchPaymentSummary = async (month) => {
    try {
      const data = await salariesAPI.getPaymentSummary(month);
      setPaymentSummary(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      console.error('Error fetching payment summary:', err);
      return [];
    }
  };

  const createSalary = async (salaryData) => {
    const newSalary = await salariesAPI.create(salaryData);
    await fetchSalaries();
    return newSalary;
  };

  const updateSalary = async (id, updates) => {
    const updated = await salariesAPI.update(id, updates);
    await fetchSalaries();
    return updated;
  };

  const deleteSalary = async (id) => {
    await salariesAPI.delete(id);
    setSalaries((prev) => prev.filter((s) => s.id !== id));
  };

  const markPaid = async (employeeId, paymentMonth, amount, notes) => {
    await salariesAPI.markPaid(employeeId, paymentMonth, amount, notes);
  };

  useEffect(() => {
    fetchSalaries();
    if (employeeId) {
      fetchCurrentSalary(employeeId);
    }
  }, [employeeId]);

  return {
    salaries,
    currentSalary,
    paymentSummary,
    loading,
    error,
    refetch: fetchSalaries,
    fetchCurrentSalary,
    fetchPaymentSummary,
    createSalary,
    updateSalary,
    deleteSalary,
    markPaid,
  };
};
