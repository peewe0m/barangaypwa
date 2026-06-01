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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    // Only react to forced logouts triggered by an exhausted refresh token.
    // Normal token expiry is handled silently via the axios interceptor refresh flow.
    const handleForcedLogout = () => {
      setUser(false);
      setLoading(false);
    };
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, []);

  /**
   * Restore the session on page load / mount.
   * Strategy:
   *  1. Try /auth/me — if the access token is still valid, we're done.
   *  2. If /auth/me returns 401 (access token expired), explicitly call
   *     /auth/refresh to get a fresh access token, then retry /auth/me.
   *  3. If refresh also fails the user is genuinely logged-out — set user=false.
   *
   * We bypass the global axios interceptor here (using _skipInterceptor) so the
   * interceptor doesn't race with our explicit refresh call on initial load.
   */
  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.me}`, {
        withCredentials: true,
        _skipInterceptor: true,   // handled below; avoids double-refresh race
      });
      setUser(data);
    } catch (error) {
      if (error.response?.status === 401) {
        // Access token expired — attempt silent refresh before giving up
        try {
          await axios.post(
            `${API_CONFIG.baseURL}/auth/refresh`,
            {},
            { withCredentials: true, _skipInterceptor: true }
          );
          // Refresh succeeded — retry /auth/me with the fresh access token cookie
          const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.me}`, {
            withCredentials: true,
            _skipInterceptor: true,
          });
          setUser(data);
        } catch {
          // Both access AND refresh tokens are expired → genuine logout
          setUser(false);
        }
      } else {
        // Network error or other non-auth failure — don't boot the user out
        setUser(false);
      }
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
      await axios.post(
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
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state regardless of API success
      setUser(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
