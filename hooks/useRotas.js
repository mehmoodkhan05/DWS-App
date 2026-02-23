import { useState, useEffect } from 'react';
import { rotasAPI } from '../lib/api';

export const useRotas = () => {
  const [rotas, setRotas] = useState([]);
  const [shiftPatterns, setShiftPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getShiftTypeById = (patternId) => {
    if (!patternId) return null;
    const pattern = shiftPatterns.find(p => p.id === patternId);
    return pattern ? pattern.type : null;
  };

  const fetchRotas = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await rotasAPI.getAll();
      setRotas(data);
    } catch (err) {
      console.error('Error fetching rotas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftPatterns = async () => {
    try {
      const data = await rotasAPI.getShiftPatterns();
      setShiftPatterns(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const createRota = async (rotaData) => {
    try {
      await rotasAPI.create(rotaData);
      await fetchRotas();
    } catch (err) {
      throw new Error(err.message || 'Failed to create rota');
    }
  };

  const createRotasBulk = async (rotasData) => {
    try {
      await rotasAPI.createBulk(rotasData);
      await fetchRotas();
    } catch (err) {
      throw new Error(err.message || 'Failed to create bulk rotas');
    }
  };

  const updateRota = async (id, updates) => {
    try {
      await rotasAPI.update(id, updates);
      await fetchRotas();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const deleteRota = async (id) => {
    try {
      await rotasAPI.delete(id);
      await fetchRotas();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const clearAllRotas = async () => {
    try {
      await rotasAPI.clearAll();
      await fetchRotas();
    } catch (err) {
      throw new Error(err.message || 'Failed to clear shifts');
    }
  };

  const createShiftPattern = async (patternData) => {
    try {
      await rotasAPI.createShiftPattern(patternData);
      await fetchShiftPatterns();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const deleteShiftPattern = async (id) => {
    try {
      await rotasAPI.deleteShiftPattern(id);
      await fetchShiftPatterns();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchRotas();
    fetchShiftPatterns();
  }, []);

  return {
    rotas,
    shiftPatterns,
    loading,
    error,
    refetch: fetchRotas,
    createRota,
    createRotasBulk,
    updateRota,
    deleteRota,
    clearAllRotas,
    createShiftPattern,
    deleteShiftPattern,
    refetchShiftPatterns: fetchShiftPatterns,
    getShiftTypeById,
  };
};
