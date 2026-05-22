const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const API_CONFIG = {
  baseURL: `${BACKEND_URL}/api`,
  endpoints: {
    // Auth
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',
    
    // Residents
    residents: '/residents',
    residentById: (id) => `/residents/${id}`,
    
    // Documents
    documentRequests: '/document-requests',
    documentRequestById: (id) => `/document-requests/${id}`,
    approveDocument: (id) => `/document-requests/${id}/approve`,
    downloadDocument: (id) => `/document-requests/${id}/download`,
    
    // Dashboard
    dashboardStats: '/dashboard/stats',
    
    // Households
    households: '/households',
    
    // Blotters
    blotters: '/blotters',
    
    // Payments
    payments: '/payments',
    
    // Config
    systemConfig: '/config/system',
  },
};

export default API_CONFIG;
