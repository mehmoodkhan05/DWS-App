// API Client for Delta Guard Rota - Node.js Backend
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';

// Get API base URL from configuration
const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL configured:', API_BASE_URL);

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

// API request helper with timeout
const apiRequest = async (endpoint, options = {}) => {
  const token = await getToken();
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log('API Request:', {
    url,
    endpoint,
    method: options.method || 'GET',
    hasToken: !!token,
  });

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    // Add timeout to fetch request (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    console.log('Making fetch request to:', url);
    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('Fetch response received:', response.status, response.statusText);

    // Read response body once and store it
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    let responseData;
    let responseText;
    
    try {
      if (isJson) {
        // Try to parse as JSON first
        responseData = await response.json();
      } else {
        // Read as text
        responseText = await response.text();
      }
    } catch (parseError) {
      // If JSON parsing fails, try reading as text
      if (isJson) {
        try {
          responseText = await response.text();
        } catch (textError) {
          // Response body already consumed, create error from status
          throw new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`);
        }
      } else {
        throw new Error(`Failed to read response: ${parseError.message}`);
      }
    }

    // Handle error responses
    if (!response.ok) {
      let errorData;
      if (responseData) {
        errorData = responseData;
      } else if (responseText) {
        // Try to parse text as JSON if it looks like JSON
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { 
            error: responseText || 'Request failed', 
            message: responseText || `HTTP error! status: ${response.status}` 
          };
        }
      } else {
        errorData = { 
          error: `HTTP error! status: ${response.status}`, 
          message: response.statusText || 'Request failed' 
        };
      }
      
      const error = new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      error.response = { data: errorData, status: response.status };
      throw error;
    }

    // Handle successful responses
    if (responseData) {
      return responseData;
    }
    
    if (responseText) {
      if (!responseText.trim()) {
        return {};
      }
      
      // Try to parse as JSON if content type suggests it might be JSON
      if (isJson || responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        try {
          return JSON.parse(responseText);
        } catch (e) {
          // If it's not valid JSON, return empty object
          console.warn('Response looks like JSON but failed to parse:', e.message);
          return {};
        }
      }
      
      return {};
    }
    
    return {};
  } catch (error) {
    // Only log non-404 errors as errors; 404s are expected for optional resources
    const is404 = error?.response?.status === 404 || error?.message?.includes('No active salary');
    if (!is404) {
      console.error('API Request Error:', {
        url,
        endpoint,
        error: error.message,
        name: error.name,
        isAbortError: error.name === 'AbortError',
      });
    }
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server took too long to respond');
    }
    
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
