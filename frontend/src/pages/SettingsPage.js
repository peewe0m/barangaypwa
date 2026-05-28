import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PageLayout, PageHeader } from '../components/PageLayout';
import { SYSTEM_CONFIG } from '../config/system';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { toast } from 'sonner';
import { ACTIONS, DEFAULT_ACTION_PERMISSIONS, DEFAULT_MODULE_PERMISSIONS, MODULES, STAFF_ACTION_PERMISSIONS, STAFF_MODULE_PERMISSIONS, isAdminRole } from '../config/modules';
import { Building2, MapPin, Phone, Mail, User, Shield, Database, Palette, FileUp, ExternalLink, Trash2, UserPlus, KeyRound, Power } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { toCsv } from './AuditLogsUtils';


const EMPTY_ACCOUNT_FORM = {

  full_name: '',
  email: '',
  password: '',
  role: 'staff',
  disabled: false,
  module_permissions: STAFF_MODULE_PERMISSIONS,
  action_permissions: STAFF_ACTION_PERMISSIONS,
};

export const SettingsPage = () => {
  const { user, refreshUser } = useAuth();
  const [systemConfig, setSystemConfig] = useState(SYSTEM_CONFIG);
  const [barangayForm, setBarangayForm] = useState(SYSTEM_CONFIG.barangayInfo);
  const bi = systemConfig.barangayInfo || SYSTEM_CONFIG.barangayInfo;
  const [templates, setTemplates] = useState([]);
  const [uploading, setUploading] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [passwords, setPasswords] = useState({});
  const [savingAccount, setSavingAccount] = useState(false);
  const adminUser = isAdminRole(user?.role);

  const fetchSystemConfig = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.systemConfig}`);
      const nextConfig = data.frontend || SYSTEM_CONFIG;
      setSystemConfig(nextConfig);
      setBarangayForm(nextConfig.barangayInfo || SYSTEM_CONFIG.barangayInfo);
    } catch {
      setSystemConfig(SYSTEM_CONFIG);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.documentTemplates}`, { withCredentials: true });
      setTemplates(data.templates || []);
    } catch {
      toast.error('Failed to load document templates');
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!adminUser) return;
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.users}`, { withCredentials: true });
      setAccounts(data.users || []);
    } catch {
      toast.error('Failed to load user accounts');
    }
  }, [adminUser]);

  const fetchAuditLogs = useCallback(async () => {
    if (!adminUser) return;
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.auditLogs}`, { withCredentials: true });
      setAuditLogs(data.logs || []);
    } catch {
      toast.error('Failed to load audit logs');
    }
  }, [adminUser]);

  useEffect(() => {
    fetchSystemConfig();
    fetchTemplates();
    fetchAccounts();
    fetchAuditLogs();
  }, [fetchAccounts, fetchAuditLogs, fetchSystemConfig, fetchTemplates]);

  useRealtimeRefresh(() => {
    fetchSystemConfig();
    fetchTemplates();
    fetchAccounts();
    fetchAuditLogs();
  });

  const activeTemplateFor = (documentType) =>
    templates.find((template) => template.document_type === documentType && template.active);

  // Template URL resolution intentionally omitted.
  // Templates are now private and must be accessed via authenticated backend proxy routes.
  // const resolveTemplateUrl = ...

  const handleTemplateUpload = async (documentType, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('template', file);
    setUploading(documentType);

    try {
      await axios.post(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.documentTemplateByType(documentType)}`,
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      toast.success('Template uploaded');
      fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload template');
    } finally {
      setUploading('');
    }
  };

  const [confirm, setConfirm] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: null,
    disabled: false,
    tone: 'danger',
  });

  const openConfirm = ({ title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', onConfirm, disabled = false }) => {
    setConfirm({ open: true, title, description, confirmLabel, cancelLabel, onConfirm, disabled, tone });
  };

  const handleTemplateRemove = async (documentType) => {
    openConfirm({
      title: 'Remove active template?',
      description: 'This will deactivate the current active template for this document type.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.documentTemplateByType(documentType)}`, { withCredentials: true });
          toast.success('Template removed');
          fetchTemplates();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to remove template');
        }
      },
    });
  };


  const handleCreateAccount = async (event) => {
    event.preventDefault();
    setSavingAccount(true);
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.users}`, accountForm, { withCredentials: true });
      toast.success('User account created');
      setAccountForm(EMPTY_ACCOUNT_FORM);
      fetchAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create account');
    } finally {
      setSavingAccount(false);
    }
  };

  const updateAccount = async (account, updates) => {
    try {
      const nextAccount = { ...account, ...updates };
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.userById(account.id)}`, nextAccount, { withCredentials: true });
      toast.success('Account updated');
      fetchAccounts();
      if (account.id === user?.id) refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update account');
    }
  };

  const changePassword = async (accountId) => {
    const password = passwords[accountId] || '';
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.userPassword(accountId)}`, { password }, { withCredentials: true });
      setPasswords((current) => ({ ...current, [accountId]: '' }));
      toast.success('Password updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update password');
    }
  };

  const deleteAccount = async (account) => {
    openConfirm({
      title: 'Delete account?',
      description: `This will disable the account for ${account.full_name}. This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.userById(account.id)}`, { withCredentials: true });
          toast.success('Account deleted');
          fetchAccounts();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to delete account');
        }
      },
    });
  };


  const setFormRole = (role) => {
    setAccountForm({
      ...accountForm,
      role,
      module_permissions: role === 'admin' ? DEFAULT_MODULE_PERMISSIONS : STAFF_MODULE_PERMISSIONS,
      action_permissions: role === 'admin' ? DEFAULT_ACTION_PERMISSIONS : STAFF_ACTION_PERMISSIONS,
    });
  };

  const setFormModule = (moduleKey, enabled) => {
    setAccountForm({
      ...accountForm,
      module_permissions: { ...accountForm.module_permissions, [moduleKey]: enabled },
    });
  };

  const setAccountModule = (account, moduleKey, enabled) => {
    updateAccount(account, {
      module_permissions: { ...account.module_permissions, [moduleKey]: enabled },
    });
  };

  const setFormAction = (moduleKey, action, enabled) => {
    setAccountForm({
      ...accountForm,
      action_permissions: {
        ...accountForm.action_permissions,
        [moduleKey]: { ...(accountForm.action_permissions?.[moduleKey] || {}), [action]: enabled },
      },
    });
  };

  const setAccountAction = (account, moduleKey, action, enabled) => {
    updateAccount(account, {
      action_permissions: {
        ...account.action_permissions,
        [moduleKey]: { ...(account.action_permissions?.[moduleKey] || {}), [action]: enabled },
      },
    });
  };

  const handleBarangaySave = async (event) => {
    event.preventDefault();
    try {
      const { data } = await axios.put(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.systemConfig}`,
        { barangayInfo: barangayForm },
        { withCredentials: true }
      );
      const nextConfig = data.frontend || SYSTEM_CONFIG;
      setSystemConfig(nextConfig);
      setBarangayForm(nextConfig.barangayInfo || barangayForm);
      toast.success('Barangay information updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update barangay information');
    }
  };

  return (
    <PageLayout testId="settings-page">
      <PageHeader title="Settings" description="System configuration and information" />

      {confirm.open && (
        <ConfirmDialog
          open={confirm.open}
          onOpenChange={(nextOpen) => setConfirm((c) => ({ ...c, open: nextOpen }))}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel}
          tone={confirm.tone}
          onConfirm={confirm.onConfirm}
          disabled={confirm.disabled}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6" data-testid="barangay-info-card">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">Barangay Information</h3>
          </div>
          {adminUser ? (
            <form onSubmit={handleBarangaySave} className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={barangayForm.name || ''} onChange={(e) => setBarangayForm({ ...barangayForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={barangayForm.address || ''} onChange={(e) => setBarangayForm({ ...barangayForm, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Municipality</Label>
                  <Input value={barangayForm.municipality || ''} onChange={(e) => setBarangayForm({ ...barangayForm, municipality: e.target.value })} />
                </div>
                <div>
                  <Label>Province</Label>
                  <Input value={barangayForm.province || ''} onChange={(e) => setBarangayForm({ ...barangayForm, province: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Region</Label>
                <Input value={barangayForm.region || ''} onChange={(e) => setBarangayForm({ ...barangayForm, region: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Contact Number</Label>
                  <Input value={barangayForm.contactNumber || ''} onChange={(e) => setBarangayForm({ ...barangayForm, contactNumber: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={barangayForm.email || ''} onChange={(e) => setBarangayForm({ ...barangayForm, email: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="bg-primary hover:bg-primary/90 hover:text-white">
                Save Barangay Information
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <InfoRow icon={Building2} label="Name" value={bi.name} />
              <InfoRow icon={MapPin} label="Address" value={bi.address} />
              <InfoRow icon={MapPin} label="Municipality" value={`${bi.municipality}, ${bi.province}`} />
              <InfoRow icon={MapPin} label="Region" value={bi.region} />
              <InfoRow icon={Phone} label="Contact" value={bi.contactNumber} />
              <InfoRow icon={Mail} label="Email" value={bi.email} />
            </div>
          )}
        </Card>

        <Card className="p-6" data-testid="officials-card">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">Barangay Officials</h3>
          </div>
          <div className="space-y-3">
            {adminUser ? (
              <form onSubmit={handleBarangaySave} className="space-y-3">
                <div>
                  <Label>Barangay Captain</Label>
                  <Input value={barangayForm.captainName || ''} onChange={(e) => setBarangayForm({ ...barangayForm, captainName: e.target.value })} />
                </div>
                <div>
                  <Label>Secretary</Label>
                  <Input value={barangayForm.secretaryName || ''} onChange={(e) => setBarangayForm({ ...barangayForm, secretaryName: e.target.value })} />
                </div>
                <div>
                  <Label>Treasurer</Label>
                  <Input value={barangayForm.treasurerName || ''} onChange={(e) => setBarangayForm({ ...barangayForm, treasurerName: e.target.value })} />
                </div>
                <Button type="submit" variant="outline">Save Officials</Button>
              </form>
            ) : (
              <>
                <InfoRow icon={User} label="Barangay Captain" value={bi.captainName} />
                <InfoRow icon={User} label="Secretary" value={bi.secretaryName} />
                <InfoRow icon={User} label="Treasurer" value={bi.treasurerName} />
              </>
            )}
          </div>
        </Card>

        <Card className="p-6" data-testid="user-account-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">Your Account</h3>
          </div>
          <div className="space-y-3">
            <InfoRow icon={User} label="Full Name" value={user?.full_name} />
            <InfoRow icon={Mail} label="Email" value={user?.email} />
            <InfoRow icon={Shield} label="Role" value={user?.role?.replace('_', ' ')} />
          </div>
        </Card>

        {adminUser && (
          <Card className="p-6 lg:col-span-2" data-testid="accounts-management-card">
            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="text-primary" size={20} />
                  <h3 className="text-lg font-heading font-semibold">Accounts & Module Access</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Create staff accounts, reset passwords, disable access, and control which modules each user can open. Delete actions remain admin-only across the system.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAccount} className="rounded-lg border border-border bg-accent/40 p-4">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="text-primary" size={18} />
                <h4 className="font-heading font-semibold">Create User Account</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Full Name</Label>
                  <Input value={accountForm.full_name} onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} required minLength={8} />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={accountForm.role} onValueChange={setFormRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {accountForm.role !== 'admin' && (
                <>
                  <ModuleSwitchGrid
                    permissions={accountForm.module_permissions}
                    onChange={setFormModule}
                    className="mt-4"
                  />
                  <ActionPermissionGrid
                    permissions={accountForm.action_permissions}
                    onChange={setFormAction}
                    className="mt-4"
                  />
                </>
              )}

              <div className="flex justify-end mt-4">
                <Button type="submit" disabled={savingAccount} className="bg-primary hover:bg-primary/90 hover:text-white">
                  <UserPlus size={16} className="mr-2" />
                  {savingAccount ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>

            <div className="mt-5 space-y-4">
              {accounts.map((account) => {
                const accountIsAdmin = isAdminRole(account.role);
                const isProtected = account.role === 'super_admin';
                return (
                  <div key={account.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-heading font-semibold text-primary">{account.full_name}</p>
                          <Badge variant={account.disabled ? 'outline' : 'default'}>{account.disabled ? 'Disabled' : 'Active'}</Badge>
                          <Badge variant="secondary">{account.role?.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{account.email}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {!isProtected && (
                          <>
                            <Select value={account.role === 'admin' ? 'admin' : 'staff'} onValueChange={(role) => updateAccount(account, { role })}>
                              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="staff">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => updateAccount(account, { disabled: !account.disabled })}
                            >
                              <Power size={14} className="mr-2" />
                              {account.disabled ? 'Enable' : 'Disable'}
                            </Button>
                            {account.id !== user?.id && (
                              <Button type="button" size="sm" variant="outline" onClick={() => deleteAccount(account)}>
                                <Trash2 size={14} className="mr-2" />
                                Delete
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                      <Input
                        type="password"
                        placeholder="New password, minimum 8 characters"
                        value={passwords[account.id] || ''}
                        onChange={(e) => setPasswords((current) => ({ ...current, [account.id]: e.target.value }))}
                      />
                      <Button type="button" variant="outline" onClick={() => changePassword(account.id)}>
                        <KeyRound size={14} className="mr-2" />
                        Change Password
                      </Button>
                    </div>

                    {accountIsAdmin ? (
                      <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                        Admin accounts have access to all modules and are the only accounts allowed to delete records.
                      </p>
                    ) : (
                      <>
                        <ModuleSwitchGrid
                          permissions={account.module_permissions || {}}
                          onChange={(moduleKey, enabled) => setAccountModule(account, moduleKey, enabled)}
                          className="mt-4"
                        />
                        <ActionPermissionGrid
                          permissions={account.action_permissions || {}}
                          onChange={(moduleKey, action, enabled) => setAccountAction(account, moduleKey, action, enabled)}
                          className="mt-4"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card className="p-6" data-testid="system-info-card">
          <div className="flex items-center gap-2 mb-4">
            <Database className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">System Info</h3>
          </div>
          <div className="space-y-3">
            <InfoRow icon={Database} label="System" value={SYSTEM_CONFIG.systemName} />
            <InfoRow icon={Database} label="Version" value={SYSTEM_CONFIG.version} />
            <InfoRow icon={Palette} label="Theme" value="Organic & Earthy (Green)" />
          </div>
        </Card>

        {adminUser && (
          <Card className="p-6 lg:col-span-2" data-testid="audit-logs-card">
            <div className="flex items-center gap-2 mb-4">
              <Database className="text-primary" size={20} />
              <h3 className="text-lg font-heading font-semibold">Recent Activity</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Path</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLogs.slice(0, 20).map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 font-medium text-primary">{log.action || log.method}</td>
                      <td className="px-3 py-2 text-muted-foreground">{log.path}</td>
                      <td className="px-3 py-2">{log.user_email || 'Public'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditLogs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>}
            </div>
          </Card>
        )}

        <Card className="p-6 lg:col-span-2" data-testid="document-fees-card">
          <h3 className="text-lg font-heading font-semibold mb-4">Document Fees</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(systemConfig.documentFees || SYSTEM_CONFIG.documentFees).map(([key, value]) => (
              <div key={key} className="p-3 bg-accent rounded-lg">
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-lg font-heading font-bold text-primary mt-1">₱{value.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Fees are configured in <code className="px-2 py-0.5 bg-accent rounded">config/system.js</code>.
          </p>
        </Card>

        <Card className="p-6 lg:col-span-2" data-testid="document-templates-card">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <FileUp className="text-primary" size={20} />
                <h3 className="text-lg font-heading font-semibold">Document Templates</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a uniform certificate layout for each document. PNG or JPG templates are used as the PDF background; PDF, DOC, and DOCX files are stored as editable references.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(systemConfig.documentTypes || SYSTEM_CONFIG.documentTypes).map((documentType) => {
              const template = activeTemplateFor(documentType.value);
              const inputId = `template-${documentType.value}`;

              return (
                <div key={documentType.value} className="p-4 bg-accent rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading font-semibold text-primary">{documentType.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {template ? template.file_name : 'No template uploaded'}
                      </p>
                    </div>
                    {template && (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <input
                      id={inputId}
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={(event) => {
                        handleTemplateUpload(documentType.value, event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploading === documentType.value}
                      onClick={() => document.getElementById(inputId)?.click()}
                    >
                      <FileUp size={14} className="mr-2" />
                      {uploading === documentType.value ? 'Uploading...' : 'Upload'}
                    </Button>
                    {template && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            const href = API_CONFIG.privateFileURL(template.storage);
                            if (href) window.open(href, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink size={14} className="mr-2" />
                          View
                        </Button>
                        {adminUser && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleTemplateRemove(documentType.value)}
                          >
                            <Trash2 size={14} className="mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
    <Icon size={16} className="text-muted-foreground mt-1" />
    <div className="flex-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  </div>
);

const ModuleSwitchGrid = ({ permissions, onChange, className = '' }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
    {MODULES.filter((module) => module.key !== 'settings').map((module) => (
      <div key={module.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
        <div>
          <p className="text-sm font-medium">{module.label}</p>
          <p className="text-xs text-muted-foreground">{permissions?.[module.key] ? 'Enabled' : 'Disabled'}</p>
        </div>
        <Switch
          checked={Boolean(permissions?.[module.key])}
          onCheckedChange={(checked) => onChange(module.key, checked)}
          aria-label={`Toggle ${module.label}`}
        />
      </div>
    ))}
  </div>
);

const ActionPermissionGrid = ({ permissions, onChange, className = '' }) => (
  <div className={className}>
    <p className="mb-2 text-sm font-semibold text-primary">Action Permissions</p>
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-secondary">
          <tr>
            <th className="px-3 py-2 text-left">Module</th>
            {ACTIONS.map((action) => (
              <th key={action} className="px-3 py-2 text-center capitalize">{action}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {MODULES.filter((module) => module.key !== 'settings').map((module) => (
            <tr key={module.key}>
              <td className="px-3 py-2 font-medium">{module.label}</td>
              {ACTIONS.map((action) => (
                <td key={action} className="px-3 py-2 text-center">
                  <Switch
                    checked={Boolean(permissions?.[module.key]?.[action])}
                    onCheckedChange={(checked) => onChange(module.key, action, checked)}
                    aria-label={`${module.label} ${action}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
