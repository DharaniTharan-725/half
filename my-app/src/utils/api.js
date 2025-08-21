import { getToken, setToken, setUserRole, getUserRole, setUserId, setUserEmail } from './auth';
import { API_BASE_URL } from './constants';

const handleResponse = async (response) => {
  if (!response.ok) {
    const text = await response.text();
    console.error('API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: Object.fromEntries(response.headers.entries()),
      body: text
    });
    const err = new Error(text || `HTTP ${response.status}`);
    err.status = response.status;
    err.statusText = response.statusText;
    err.url = response.url;
    throw err;
  }
  return response.json();
};

// ---------------------- Admin Auth ----------------------
// Test backend connectivity and token validity
export const testBackendConnection = async () => {
  try {
    console.log('Testing backend connection...');
    
    // Test basic connectivity
    const healthResponse = await fetch(`${API_BASE_URL}/actuator/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (healthResponse.ok) {
      console.log('Backend is accessible');
    } else {
      console.warn('Backend health check failed:', healthResponse.status);
    }
    
    // Test CORS preflight
    try {
      const corsTestResponse = await fetch(`${API_BASE_URL}/api/v1/admin/feedback`, {
        method: 'OPTIONS',
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type'
        }
      });
      console.log('CORS preflight test:', corsTestResponse.status);
    } catch (corsError) {
      console.warn('CORS preflight test failed:', corsError);
    }
    
    // Test token validity if available
    const token = getToken();
    if (token) {
      try {
        const tokenTestResponse = await fetch(`${API_BASE_URL}/api/auth/validate`, {
          method: 'GET',
          headers: authHeaders()
        });
        
        if (tokenTestResponse.ok) {
          console.log('Token is valid');
          return true;
        } else {
          console.warn('Token validation failed:', tokenTestResponse.status);
          return false;
        }
      } catch (error) {
        console.warn('Token validation endpoint not available or failed:', error);
        return false;
      }
    } else {
      console.log('No token available for validation');
      return false;
    }
  } catch (error) {
    console.error('Backend connection test failed:', error);
    return false;
  }
};

// Test specific admin endpoints to identify the issue
export const testAdminEndpoints = async () => {
  try {
    console.log('Testing admin endpoints...');
    
    // Test 1: Basic admin feedback endpoint
    try {
      const response1 = await fetch(`${API_BASE_URL}/api/v1/admin/feedback?page=0&size=5`, {
        headers: authHeaders()
      });
      console.log('Admin feedback endpoint test:', response1.status, response1.statusText);
      
      if (!response1.ok) {
        const errorText = await response1.text();
        console.error('Admin feedback endpoint error:', errorText);
      }
    } catch (error) {
      console.error('Admin feedback endpoint test failed:', error);
    }
    
    // Test 2: Categories endpoint
    try {
      const response2 = await fetch(`${API_BASE_URL}/api/v1/admin/categories/all`, {
        headers: authHeaders()
      });
      console.log('Categories endpoint test:', response2.status, response2.statusText);
      
      if (!response2.ok) {
        const errorText = await response2.text();
        console.error('Categories endpoint error:', errorText);
      }
    } catch (error) {
      console.error('Categories endpoint test failed:', error);
    }
    
    // Test 3: All feedback endpoint (the one giving 500 error)
    try {
      const response3 = await fetch(`${API_BASE_URL}/api/v1/admin/feedback/all`, {
        headers: authHeaders()
      });
      console.log('All feedback endpoint test:', response3.status, response3.statusText);
      
      if (!response3.ok) {
        const errorText = await response3.text();
        console.error('All feedback endpoint error:', errorText);
      }
    } catch (error) {
      console.error('All feedback endpoint test failed:', error);
    }
    
  } catch (error) {
    console.error('Admin endpoints test failed:', error);
  }
};

// Test database connectivity (if backend has health endpoint)
export const testDatabaseHealth = async () => {
  try {
    console.log('Testing database health...');
    
    // Try common health endpoints
    const healthEndpoints = [
      '/actuator/health',
      '/health',
      '/health/db',
      '/api/health'
    ];
    
    for (const endpoint of healthEndpoints) {
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.text();
          console.log(`Database health check (${endpoint}):`, data);
          return true;
        } else {
          console.log(`Health endpoint ${endpoint} returned:`, response.status);
        }
      } catch (error) {
        console.log(`Health endpoint ${endpoint} failed:`, error.message);
      }
    }
    
    console.log('No working health endpoints found');
    return false;
    
  } catch (error) {
    console.error('Database health test failed:', error);
    return false;
  }
};

// Register admin
export const registerAdmin = async (data) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/admin/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse(response);
  // Store email as user identifier for future use
  if (data.email) {
    setUserId(data.email);
    setUserEmail(data.email);
  }
  return result;
};

// ---------------------- User Auth ----------------------
// Register user
export const registerUser = async (data) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse(response);
  // Store email as user identifier for future use
  if (data.email) {
    setUserId(data.email);
    setUserEmail(data.email);
  }
  return result;
};

// Universal login (checks both admin and user)
export const login = async (data) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse(response);
  if (result.token) {
    setToken(result.token);
    setUserRole(result.role);
    // Store email as user identifier since backend doesn't return userId
    if (data.email) {
      setUserId(data.email);
      setUserEmail(data.email);
    }
  }
  return result;
};

// Legacy admin login (for backward compatibility)
export const loginAdmin = async (data) => {
  return login(data);
};

// ---------------------- Feedback APIs ----------------------
const authHeaders = () => {
  const token = getToken();
  const userRole = getUserRole();
  console.log('Auth headers - token:', token ? 'present' : 'missing');
  console.log('Auth headers - userRole:', userRole);
  console.log('Auth headers - token value:', token);
  
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  console.log('Final headers:', headers);
  return headers;
};

// Verify authentication before making admin calls
const verifyAdminAuth = () => {
  const token = getToken();
  const userRole = getUserRole();
  
  if (!token) {
    throw new Error('No authentication token found. Please log in again.');
  }
  
  if (userRole !== 'ADMIN') {
    throw new Error('Admin role required. Current role: ' + userRole);
  }
  
  console.log('Admin authentication verified - Token present, Role: ADMIN');
};

// Submit feedback (public)
export const submitFeedback = async (feedback) => {
  const response = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(feedback),
  });
  return handleResponse(response);
};

// Get feedback by user (public)
export const getUserFeedback = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/feedback/user/${userId}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(errorText || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
};

// Admin: search feedback with pagination, sorting, filtering
export const searchAdminFeedback = async ({ page = 0, size = 10, sortBy = 'createdAt', sortOrder = 'desc', name, email, status, rating, category }) => {
  try {
    verifyAdminAuth();
    
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('size', size);
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);
    if (name) params.append('name', name);
    if (email) params.append('email', email);
    if (status) params.append('status', status);
    if (rating != null && rating !== '') params.append('rating', rating);
    if (category) params.append('category', category);

    console.log('Making admin feedback search request to:', `${API_BASE_URL}/api/v1/admin/feedback?${params.toString()}`);
    
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/feedback?${params.toString()}`, {
      headers: authHeaders(),
    });
    return handleResponse(response);
  } catch (error) {
    console.error('searchAdminFeedback error:', error);
    throw error;
  }
};

// Get all feedback (legacy)
export const getAllFeedback = async () => {
  try {
    verifyAdminAuth();
    
    console.log('Making getAllFeedback request to:', `${API_BASE_URL}/api/v1/admin/feedback/all`);
    
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/feedback/all`, {
      headers: authHeaders(),
    });
    return handleResponse(response);
  } catch (error) {
    console.error('getAllFeedback error:', error);
    throw error;
  }
};

// Update feedback status (admin, JWT required)
export const updateFeedbackStatus = async (id, status) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/feedback/${id}/status`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse(response);
};

// Update feedback category (admin)
export const updateFeedbackCategory = async (id, categoryId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/feedback/${id}/category/${categoryId}`, {
    method: "PUT",
    headers: authHeaders(),
  });
  return handleResponse(response);
};

// Delete feedback (admin, JWT required)
export const deleteFeedback = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/feedback/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return true;
};

// ---------------------- Category APIs ----------------------
export const listCategories = async ({ page = 0, size = 50, name } = {}) => {
  const params = new URLSearchParams();
  params.append('page', page);
  params.append('size', size);
  if (name) params.append('name', name);
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/categories?${params.toString()}`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
};

export const listAllCategories = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/categories/all`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
};

export const createCategory = async (category) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/categories`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(category),
  });
  return handleResponse(response);
};

export const updateCategory = async (id, category) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/categories/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(category),
  });
  return handleResponse(response);
};

export const deleteCategory = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return true;
};
