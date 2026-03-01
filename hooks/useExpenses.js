import { useState, useEffect } from 'react';
import { expensesAPI, expenseCategoriesAPI } from '../lib/api';

export const useExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await expensesAPI.getAll();
      setExpenses(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await expenseCategoriesAPI.getAll();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const createExpense = async (expenseData) => {
    const newExpense = await expensesAPI.create(expenseData);
    await fetchExpenses();
    return newExpense;
  };

  const updateExpense = async (id, updates) => {
    const updated = await expensesAPI.update(id, updates);
    await fetchExpenses();
    return updated;
  };

  const deleteExpense = async (id) => {
    await expensesAPI.delete(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const markPaid = async (id) => {
    await expensesAPI.markPaid(id);
    await fetchExpenses();
  };

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, []);

  return {
    expenses,
    categories,
    loading,
    error,
    refetch: fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    markPaid,
  };
};
