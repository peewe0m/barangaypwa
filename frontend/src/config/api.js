const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const API_CONFIG = {
  baseURL: `${BACKEND_URL}/api`,
  uploadsURL: `${BACKEND_URL}/uploads`,
  endpoints: {
    // Auth
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',

    // Residents
    residents: '/residents',
    residentById: (id) => `/residents/${id}`,
    residentPhoto: (id) => `/residents/${id}/photo`,

    // Households
    households: '/households',
    householdById: (id) => `/households/${id}`,
    householdMembers: (id) => `/households/${id}/members`,
    addHouseholdMember: (hid, rid) => `/households/${hid}/add-member/${rid}`,

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

    // Portal (public)
    portalRequest: '/portal/document-request',
    trackRequest: (tn) => `/portal/track/${tn}`,
    portalRequests: '/portal-requests',
    processPortalRequest: (id) => `/portal-requests/${id}/process`,

    // Seed
    seedData: '/seed/sample-data',

    // Config
    systemConfig: '/config/system',
  },
};

export default API_CONFIG;
