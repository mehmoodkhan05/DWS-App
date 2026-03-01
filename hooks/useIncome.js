import { useState, useEffect } from 'react';
import { incomeAPI } from '../lib/api';

export const useIncome = () => {
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIncome = async (startDate, endDate) => {
    try {
      setLoading(true);
      const data = await incomeAPI.getAll(startDate, endDate);
      setIncomeEntries(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlySummary = async (month) => {
    try {
      const data = await incomeAPI.getMonthlySummary(month);
      setMonthlySummary(data);
      return data;
    } catch (err) {
      console.error('Error fetching monthly summary:', err);
      return null;
    }
  };

  const createIncome = async (incomeData) => {
    const newIncome = await incomeAPI.create(incomeData);
    await fetchIncome();
    return newIncome;
  };

  const updateIncome = async (id, updates) => {
    const updated = await incomeAPI.update(id, updates);
    await fetchIncome();
    return updated;
  };

  const deleteIncome = async (id) => {
    await incomeAPI.delete(id);
    setIncomeEntries((prev) => prev.filter((i) => i.id !== id));
  };

  useEffect(() => {
    fetchIncome();
  }, []);

  return {
    incomeEntries,
    monthlySummary,
    loading,
    error,
    refetch: fetchIncome,
    fetchMonthlySummary,
    createIncome,
    updateIncome,
    deleteIncome,
  };
};
