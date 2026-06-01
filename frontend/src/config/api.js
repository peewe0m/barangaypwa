import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://barangaypwa.onrender.com';

// In-memory fallback for when the csrf_token cookie hasn't propagated yet
// (e.g. the very first POST fired right after login)
let cachedCsrfToken = '';

const getCsrfToken = () => {
  const fromCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('csrf_token='))
    ?.split('=')
    .slice(1)
    .join('=') || '';

  if (fromCookie) {
    cachedCsrfToken = decodeURIComponent(fromCookie);
  }

  return cachedCsrfToken;
};

// Cache the CSRF token from every response so it's available immediately
// for the next request, even before the browser applies the Set-Cookie header.
// Also handle 401 by attempting a silent token refresh before giving up.
let isRefreshing = false;
let refreshQueue = []; // { resolve, reject }

function processRefreshQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

axios.interceptors.response.use(
  (response) => {
    const token = response.headers?.['x-csrf-token'];
    if (token) cachedCsrfToken = token;
    return response;
  },
  async (error) => {
    const token = error.response?.headers?.['x-csrf-token'];
    if (token) cachedCsrfToken = token;

    const originalRequest = error.config;

    // Allow certain calls (e.g. checkAuth on mount) to bypass this interceptor
    // so they can handle refresh logic themselves without a race condition.
    if (originalRequest?._skipInterceptor) {
      return Promise.reject(error);
    }

    const is401 = error.response?.status === 401;
    const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh');
    const isLoginEndpoint = originalRequest?.url?.includes('/auth/login');
    const alreadyRetried = originalRequest?._retry;

    // Attempt a silent token refresh on 401, but not for login/refresh endpoints
    if (is401 && !alreadyRetried && !isRefreshEndpoint && !isLoginEndpoint) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => {
          return axios(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${BACKEND_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        processRefreshQueue(null);
        return axios(originalRequest);
      } catch (refreshError) {
        processRefreshQueue(refreshError);
        // Refresh failed — the session is truly gone. Clear auth hint and notify the app.
        const isProd = window.location.protocol === 'https:';
        document.cookie = `auth_hint=; Max-Age=0; path=/; SameSite=${isProd ? 'None' : 'Lax'}${isProd ? '; Secure' : ''}`;
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

axios.interceptors.request.use((config) => {
  const method = String(config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers = config.headers || {};
    config.headers['x-csrf-token'] = getCsrfToken();
  }
  return config;
});

export const API_CONFIG = {
  baseURL: `${BACKEND_URL}/api`,
  privateFileURL: (storage) => {
    if (!storage?.provider || !storage?.key) return '';
    const provider = encodeURIComponent(storage.provider);
    const key = String(storage.key).split('/').map(encodeURIComponent).join('/');
    return `${BACKEND_URL}/api/private-files/${provider}/${key}`;
  },
  endpoints: {
    // Auth
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',
    events: '/events',
    users: '/users',
    userById: (id) => `/users/${id}`,
    userPassword: (id) => `/users/${id}/password`,
    modules: '/modules',
    auditLogs: '/audit-logs',

    // Residents
    residents: '/residents',
    residentById: (id) => `/residents/${id}`,
    residentPhoto: (id) => `/residents/${id}/photo`,

    // Households
    households: '/households',
    householdById: (id) => `/households/${id}`,
    householdMembers: (id) => `/households/${id}/members`,
    addHouseholdMember: (hid, rid) => `/households/${hid}/add-member/${rid}`,
    removeHouseholdMember: (hid, rid) => `/households/${hid}/remove-member/${rid}`,

    // Documents
    documentRequests: '/document-requests',
    approveDocument: (id) => `/document-requests/${id}/approve`,
    rejectDocument: (id) => `/document-requests/${id}/reject`,
    downloadDocument: (id) => `/document-requests/${id}/download`,
    claimDocument: (id) => `/document-requests/${id}/claim`,

    // Businesses
    businesses: '/businesses',
    renewBusiness: (id) => `/businesses/${id}/renew`,
    businessById: (id) => `/businesses/${id}`,

    // Blotter
    blotters: '/blotters',
    blotterById: (id) => `/blotters/${id}`,

    // Health
    healthRecords: '/health-records',
    healthRecordById: (id) => `/health-records/${id}`,

    // Medicine Inventory
    medicineInventory: '/medicine-inventory',
    medicineInventoryById: (id) => `/medicine-inventory/${id}`,
    medicineAdjust: (id) => `/medicine-inventory/${id}/adjust`,

    // Welfare
    welfareRecords: '/welfare-records',
    welfareRecordById: (id) => `/welfare-records/${id}`,

    // Appointments
    appointments: '/appointments',
    appointmentById: (id) => `/appointments/${id}`,
    appointmentStatus: (id) => `/appointments/${id}/status`,

    // Payments
    payments: '/payments',
    paymentById: (id) => `/payments/${id}`,

    // Barangay ID
    barangayIds: '/barangay-ids',
    barangayIdById: (id) => `/barangay-ids/${id}`,
    downloadBarangayId: (id) => `/barangay-ids/${id}/download`,

    // Dashboard
    dashboardStats: '/dashboard/stats',

    // Reports
    residentReport: '/reports/residents',
    financialReport: '/reports/financial',
    exportCsv: (type) => `/exports/${type}`,

    // Portal (public)
    portalRequest: '/portal/document-request',
    trackRequest: (tn) => `/portal/track/${tn}`,
    trackDownload: (tn) => `/portal/track/${tn}/download`,
    portalRequests: '/portal-requests',
    processPortalRequest: (id) => `/portal-requests/${id}/process`,
    linkPortalRequestToDocument: (id) => `/portal-requests/${id}/link-document`,

    // Seed
    seedData: '/seed/sample-data',

    // Config
    systemConfig: '/config/system',
    documentTemplates: '/document-templates',
    documentTemplateByType: (type) => `/document-templates/${type}`,
  },
};

export default API_CONFIG;
