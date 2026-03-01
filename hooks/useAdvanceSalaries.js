import { useState, useEffect } from 'react';
import { advanceSalariesAPI } from '../lib/api';

export const useAdvanceSalaries = () => {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const data = await advanceSalariesAPI.getAll();
      setAdvances(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAdvance = async (advanceData) => {
    const newAdvance = await advanceSalariesAPI.create(advanceData);
    await fetchAdvances();
    return newAdvance;
  };

  const updateAdvance = async (id, updates) => {
    const updated = await advanceSalariesAPI.update(id, updates);
    await fetchAdvances();
    return updated;
  };

  const updateStatus = async (id, status, rejectionReason, adminNotes) => {
    await advanceSalariesAPI.updateStatus(id, status, rejectionReason, adminNotes);
    await fetchAdvances();
  };

  const deleteAdvance = async (id) => {
    await advanceSalariesAPI.delete(id);
    setAdvances((prev) => prev.filter((a) => a.id !== id));
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  return {
    advances,
    loading,
    error,
    refetch: fetchAdvances,
    createAdvance,
    updateAdvance,
    updateStatus,
    deleteAdvance,
  };
};
