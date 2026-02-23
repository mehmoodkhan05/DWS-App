// API Client for Delta Guard Rota - Node.js Backend
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';

// Get API base URL from configuration
const API_BASE_URL = getApiBaseUrl();

// Get auth token from AsyncStorage
export const getToken = async () => {
  try {
    return await AsyncStorage.getItem('auth_token');
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// Set auth token in AsyncStorage
export const setToken = async (token) => {
  try {
    await AsyncStorage.setItem('auth_token', token);
  } catch (error) {
    console.error('Error setting token:', error);
  }
};

// Remove auth token from AsyncStorage
export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem('auth_token');
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

// API request helper
const apiRequest = async (endpoint, options = {}) => {
  const token = await getToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        const text = await response.text();
        errorData = { error: text || 'Request failed', message: text || 'Request failed' };
      }
      const error = new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      error.response = { data: errorData, status: response.status };
      throw error;
    }

    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (!text || text.trim() === '') {
      return {};
    }
    
    if (contentType && contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }
    }
    return {};
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error');
  }
};

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      await setToken(data.token);
    }
    return data;
  },

  register: async (email, password, fullName, role) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });
    if (data.token) {
      await setToken(data.token);
    }
    return data;
  },

  getMe: async () => {
    return apiRequest('/auth/me');
  },

  logout: async () => {
    await removeToken();
  },
};

// Profiles API
export const profilesAPI = {
  getAll: () => apiRequest('/profiles'),
  getById: (id) => apiRequest(`/profiles/${id}`),
  create: (data) => apiRequest('/profiles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updatePassword: (id, password) => apiRequest(`/profiles/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
  delete: (id) => apiRequest(`/profiles/${id}`, { method: 'DELETE' }),
  toggleActive: (id) => apiRequest(`/profiles/${id}/toggle-active`, { method: 'PATCH' }),
};

// Rotas API
export const rotasAPI = {
  getAll: () => apiRequest('/rotas'),
  getById: (id) => apiRequest(`/rotas/${id}`),
  create: (data) => apiRequest('/rotas', { method: 'POST', body: JSON.stringify(data) }),
  createBulk: (data) => apiRequest('/rotas/bulk', { method: 'POST', body: JSON.stringify({ rotas: data }) }),
  update: (id, data) => apiRequest(`/rotas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/rotas/${id}`, { method: 'DELETE' }),
  clearAll: () => apiRequest('/rotas', { method: 'DELETE' }),
  getShiftPatterns: () => apiRequest('/rotas/shift-patterns/list'),
  createShiftPattern: (data) => apiRequest('/rotas/shift-patterns', { method: 'POST', body: JSON.stringify(data) }),
  deleteShiftPattern: (id) => apiRequest(`/rotas/shift-patterns/${id}`, { method: 'DELETE' }),
};

// Requests API
export const requestsAPI = {
  getAll: () => apiRequest('/requests'),
  getById: (id) => apiRequest(`/requests/${id}`),
  create: (data) => apiRequest('/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status, adminNotes) => 
    apiRequest(`/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, admin_notes: adminNotes }) }),
  delete: (id) => apiRequest(`/requests/${id}`, { method: 'DELETE' }),
};

// Messages API
export const messagesAPI = {
  getAll: async (recipientId) => {
    const query = recipientId ? `?recipient_id=${recipientId}` : '';
    return apiRequest(`/messages${query}`);
  },
  send: (recipientId, content) => 
    apiRequest('/messages', { method: 'POST', body: JSON.stringify({ recipient_id: recipientId, content }) }),
  markAsRead: (id) => apiRequest(`/messages/${id}/read`, { method: 'PATCH' }),
  getGroupMessages: () => apiRequest('/messages/group'),
  sendGroupMessage: (content) => 
    apiRequest('/messages/group', { method: 'POST', body: JSON.stringify({ content }) }),
};

// Announcements API
export const announcementsAPI = {
  getAll: () => apiRequest('/announcements'),
  getById: (id) => apiRequest(`/announcements/${id}`),
  create: (data) => apiRequest('/announcements', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/announcements/${id}`, { method: 'DELETE' }),
};

// Audit Log API
export const auditLogAPI = {
  getAll: (severity, category, limit) => {
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    if (category) params.append('category', category);
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/audit-log${query}`);
  },
  getById: (id) => apiRequest(`/audit-log/${id}`),
};

// Expense Categories API
export const expenseCategoriesAPI = {
  getAll: () => apiRequest('/expense-categories'),
  getById: (id) => apiRequest(`/expense-categories/${id}`),
  create: (data) => apiRequest('/expense-categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/expense-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/expense-categories/${id}`, { method: 'DELETE' }),
};

// Expenses API
export const expensesAPI = {
  getAll: () => apiRequest('/expenses'),
  getByMonth: (month) => apiRequest(`/expenses/month/${month}`),
  getById: (id) => apiRequest(`/expenses/${id}`),
  create: (data) => apiRequest('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  markPaid: (id) => apiRequest(`/expenses/${id}/mark-paid`, { method: 'PATCH' }),
  markPaidBulk: (expenseIds) => apiRequest('/expenses/mark-paid-bulk', { method: 'PATCH', body: JSON.stringify({ expense_ids: expenseIds }) }),
  processMonthEnd: (paymentMonth, employeeId) => apiRequest('/expenses/process-month-end', { method: 'POST', body: JSON.stringify({ payment_month: paymentMonth, employee_id: employeeId }) }),
  delete: (id) => apiRequest(`/expenses/${id}`, { method: 'DELETE' }),
};

// Income API
export const incomeAPI = {
  getAll: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();
    return apiRequest(`/income${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiRequest(`/income/${id}`),
  getStats: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();
    return apiRequest(`/income/stats/summary${query ? `?${query}` : ''}`);
  },
  getMonthlySummary: (month) => {
    const params = month ? `?month=${encodeURIComponent(month)}` : '';
    return apiRequest(`/income/monthly-summary${params}`);
  },
  getCategorizedSummary: (month) => {
    const params = month ? `?month=${encodeURIComponent(month)}` : '';
    return apiRequest(`/income/categorized-summary${params}`);
  },
  create: (data) => apiRequest('/income', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/income/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/income/${id}`, { method: 'DELETE' }),
};

// Salaries API
export const salariesAPI = {
  getAll: () => apiRequest('/salaries'),
  getById: (id) => apiRequest(`/salaries/${id}`),
  getCurrent: (employeeId) => apiRequest(`/salaries/employee/${employeeId}/current`),
  getPaymentSummary: (month) => {
    const params = month ? `?month=${encodeURIComponent(month)}` : '';
    return apiRequest(`/salaries/payment-summary${params}`);
  },
  markPaid: (employeeId, paymentMonth, amount, notes) => 
    apiRequest('/salaries/mark-paid', { 
      method: 'POST', 
      body: JSON.stringify({ employee_id: employeeId, payment_month: paymentMonth, amount, notes }) 
    }),
  create: (data) => apiRequest('/salaries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/salaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/salaries/${id}`, { method: 'DELETE' }),
};

// Advance Salaries API
export const advanceSalariesAPI = {
  getAll: () => apiRequest('/advance-salaries'),
  getById: (id) => apiRequest(`/advance-salaries/${id}`),
  create: (data) => apiRequest('/advance-salaries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/advance-salaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id, status, rejectionReason, adminNotes) => apiRequest(`/advance-salaries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, rejection_reason: rejectionReason, admin_notes: adminNotes }) }),
  delete: (id) => apiRequest(`/advance-salaries/${id}`, { method: 'DELETE' }),
};
