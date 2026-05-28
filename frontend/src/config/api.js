import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const csrfToken = () =>
  document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('csrf_token='))
    ?.split('=')
    .slice(1)
    .join('=') || '';

axios.interceptors.request.use((config) => {
  const method = String(config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers = config.headers || {};
    config.headers['x-csrf-token'] = decodeURIComponent(csrfToken());
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


    // Seed
    seedData: '/seed/sample-data',

    // Config
    systemConfig: '/config/system',
    documentTemplates: '/document-templates',
    documentTemplateByType: (type) => `/document-templates/${type}`,
  },
};

export default API_CONFIG;
