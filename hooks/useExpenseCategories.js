import { useState, useEffect } from 'react';
import { expenseCategoriesAPI } from '../lib/api';

export const useExpenseCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await expenseCategoriesAPI.getAll();
      setCategories(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (categoryData) => {
    const newCat = await expenseCategoriesAPI.create(categoryData);
    await fetchCategories();
    return newCat;
  };

  const updateCategory = async (id, updates) => {
    const updated = await expenseCategoriesAPI.update(id, updates);
    await fetchCategories();
    return updated;
  };

  const deleteCategory = async (id) => {
    await expenseCategoriesAPI.delete(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};
