export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'residents', label: 'Residents', path: '/residents' },
  { key: 'households', label: 'Households', path: '/households' },
  { key: 'documents', label: 'Documents', path: '/documents' },
  { key: 'portal_requests', label: 'Online Requests', path: '/portal-requests' },
  { key: 'business', label: 'Business', path: '/business' },
  { key: 'blotter', label: 'Blotter', path: '/blotter' },
  { key: 'health', label: 'Health', path: '/health' },
  { key: 'medicine_inventory', label: 'Medicine Inventory', path: '/medicine-inventory' },
  { key: 'welfare', label: 'Social Welfare', path: '/welfare' },
  { key: 'barangay_id', label: 'Barangay ID', path: '/barangay-id' },
  { key: 'appointments', label: 'Appointments', path: '/appointments' },
  { key: 'payments', label: 'Payments', path: '/payments' },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'settings', label: 'Settings', path: '/settings' },
];

export const DEFAULT_MODULE_PERMISSIONS = Object.fromEntries(MODULES.map((module) => [module.key, true]));

export const STAFF_MODULE_PERMISSIONS = Object.fromEntries(
  MODULES.map((module) => [module.key, module.key !== 'settings'])
);

export const ACTIONS = ['view', 'create', 'update', 'delete', 'approve', 'download', 'export'];

export const DEFAULT_ACTION_PERMISSIONS = Object.fromEntries(
  MODULES.map((module) => [module.key, Object.fromEntries(ACTIONS.map((action) => [action, true]))])
);

export const STAFF_ACTION_PERMISSIONS = Object.fromEntries(
  MODULES.map((module) => [
    module.key,
    Object.fromEntries(ACTIONS.map((action) => [action, action !== 'delete']))
  ])
);

export const isAdminRole = (role) => ['admin', 'super_admin'].includes(role);

export const hasModuleAccess = (user, moduleKey) => {
  if (!moduleKey) return true;
  if (isAdminRole(user?.role)) return true;
  return Boolean(user?.module_permissions?.[moduleKey]);
};

export const hasActionAccess = (user, moduleKey, action) => {
  if (!moduleKey || !action) return true;
  if (isAdminRole(user?.role)) return true;
  return Boolean(user?.action_permissions?.[moduleKey]?.[action]);
};
