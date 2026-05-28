import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../config/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

function formatApiErrorDetail(detail) {
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

function hasAuthHint() {
  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim().startsWith('auth_hint='));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    // Listen for the forced-logout event fired by the axios 401 interceptor
    // when a token refresh fails (session truly expired).
    const handleForcedLogout = () => { setUser(false); setLoading(false); };
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, []);

  const checkAuth = async () => {
    // Always attempt /auth/me — the server is the source of truth.
    // The auth_hint cookie is unreliable across origins and browser quirks,
    // so we never short-circuit based on it alone.
    }

    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.me}`, {
        withCredentials: true,
      });
      setUser(data);
    } catch (error) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.login}`,
        { email, password },
        { withCredentials: true }
      );
      setUser(data);
      return { success: true };
    } catch (error) {
      const message = formatApiErrorDetail(error.response?.data?.detail) || error.message;
      return { success: false, error: message };
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const register = async (email, password, full_name, role) => {
    try {
      const { data } = await axios.post(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.register}`,
        { email, password, full_name, role },
        { withCredentials: true }
      );
      return { success: true };
    } catch (error) {
      const message = formatApiErrorDetail(error.response?.data?.detail) || error.message;
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.logout}`, {}, { withCredentials: true });
      setUser(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
