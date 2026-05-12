/**
 * API Wrapper — Handles auth headers, errors, and base URL
 */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('lms_token');
}

export function setToken(token) {
  localStorage.setItem('lms_token', token);
}

export function clearToken() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_user');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('lms_user'));
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem('lms_user', JSON.stringify(user));
}

export function isLoggedIn() {
  return !!getToken();
}

export function isAdmin() {
  return getUser()?.role === 'admin';
}

/**
 * Fetch wrapper with auth headers
 */
async function fetchAPI(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.location.hash = '#/login';
    }
    throw new Error(data.error || 'Có lỗi xảy ra');
  }

  return data;
}

// Convenience methods
export const api = {
  get: (endpoint) => fetchAPI(endpoint),
  post: (endpoint, body) => fetchAPI(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => fetchAPI(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => fetchAPI(endpoint, { method: 'DELETE' }),
  baseUrl: API_BASE
};
