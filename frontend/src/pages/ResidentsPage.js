import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Camera, User } from 'lucide-react';
import API_CONFIG from '../config/api';
import { SYSTEM_CONFIG } from '../config/system';

const EMPTY_FORM = {
  full_name: '', address: '', birthdate: '', gender: 'Male', civil_status: 'Single',
  citizenship: 'Filipino', contact_number: '', occupation: '', email: '',
  religion: 'Roman Catholic', is_voter: false, is_pwd: false, is_senior: false,
  is_solo_parent: false, emergency_contact: '',
};

export const ResidentsPage = () => {
  const [residents, setResidents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const fileInputRef = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);

  useEffect(() => { fetchResidents(); }, [searchQuery]);

  const fetchResidents = async () => {
    try {
      const params = searchQuery ? { search: searchQuery } : {};
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { params, withCredentials: true });
      setResidents(data.residents || []);
    } catch { toast.error('Failed to load residents'); }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (resident) => {
    setEditingId(resident.id);
    setForm({
      ...EMPTY_FORM,
      ...resident,
      email: resident.email || '',
      contact_number: resident.contact_number || '',
      occupation: resident.occupation || '',
      religion: resident.religion || 'Roman Catholic',
      emergency_contact: resident.emergency_contact || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residentById(editingId)}`, form, { withCredentials: true });
        toast.success('Resident updated');
      } else {
        await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, form, { withCredentials: true });
        toast.success('Resident added');
      }
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchResidents();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (residentId) => {
    if (!window.confirm('Delete this resident?')) return;
    try {
      await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residentById(residentId)}`, { withCredentials: true });
      toast.success('Resident deleted');
      fetchResidents();
    } catch { toast.error('Failed to delete'); }
  };

  const handlePhotoUpload = async (residentId, file) => {
    if (!file) return;
    setUploadingFor(residentId);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residentPhoto(residentId)}`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Photo uploaded');
      fetchResidents();
    } catch { toast.error('Failed to upload photo'); }
    finally { setUploadingFor(null); }
  };

  const triggerUpload = (residentId) => {
    fileInputRef.current.dataset.residentId = residentId;
    fileInputRef.current.click();
  };

  const onFileChange = (e) => {
    const residentId = fileInputRef.current.dataset.residentId;
    const file = e.target.files[0];
    if (file && residentId) handlePhotoUpload(residentId, file);
    e.target.value = '';
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 md:p-8" data-testid="residents-page">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold text-primary">Residents</h1>
            <p className="text-muted-foreground mt-2">Manage barangay residents</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-resident-button" onClick={openCreate} className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Add Resident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? 'Edit Resident' : 'Add New Resident'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Full Name *</Label>
                    <Input data-testid="resident-fullname-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                  </div>
                  <div className="col-span-2">
                    <Label>Address *</Label>
                    <Input data-testid="resident-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Birthdate *</Label>
                    <Input type="date" data-testid="resident-birthdate-input" value={form.birthdate?.split('T')[0] || ''} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Gender *</Label>
                    <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                      <SelectTrigger data-testid="resident-gender-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{SYSTEM_CONFIG.gender.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Civil Status *</Label>
                    <Select value={form.civil_status} onValueChange={(v) => setForm({ ...form, civil_status: v })}>
                      <SelectTrigger data-testid="resident-civilstatus-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{SYSTEM_CONFIG.civilStatus.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Contact Number</Label>
                    <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
                  </div>
                  <div>
                    <Label>Occupation</Label>
                    <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Religion</Label>
                    <Select value={form.religion} onValueChange={(v) => setForm({ ...form, religion: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SYSTEM_CONFIG.religions.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2"><input type="checkbox" data-testid="resident-voter-checkbox" checked={form.is_voter} onChange={(e) => setForm({ ...form, is_voter: e.target.checked })} className="rounded" /><span className="text-sm">Registered Voter</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" data-testid="resident-pwd-checkbox" checked={form.is_pwd} onChange={(e) => setForm({ ...form, is_pwd: e.target.checked })} className="rounded" /><span className="text-sm">PWD</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" data-testid="resident-senior-checkbox" checked={form.is_senior} onChange={(e) => setForm({ ...form, is_senior: e.target.checked })} className="rounded" /><span className="text-sm">Senior Citizen</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" data-testid="resident-solo-parent-checkbox" checked={form.is_solo_parent} onChange={(e) => setForm({ ...form, is_solo_parent: e.target.checked })} className="rounded" /><span className="text-sm">Solo Parent</span></label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="resident-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                    {editingId ? 'Save Changes' : 'Add Resident'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input data-testid="residents-search-input" placeholder="Search by name or address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="residents-table">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Gender</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {residents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-accent/50" data-testid={`resident-row-${resident.id}`}>
                    <td className="px-6 py-3">
                      <button onClick={() => triggerUpload(resident.id)} className="relative group" data-testid={`upload-photo-${resident.id}`}>
                        {resident.photo_url ? (
                          <img src={`${API_CONFIG.uploadsURL.replace('/uploads', '')}${resident.photo_url}`} alt={resident.full_name}
                               className="w-10 h-10 rounded-full object-cover border-2 border-primary/20" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                            <User size={18} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <Camera size={14} className="text-white" />
                        </div>
                        {uploadingFor === resident.id && (
                          <div className="absolute inset-0 rounded-full bg-white/80 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-medium">{resident.full_name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">{resident.address}</td>
                    <td className="px-6 py-4 text-sm">{resident.age}</td>
                    <td className="px-6 py-4 text-sm">{resident.gender}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-1 flex-wrap">
                        {resident.is_voter && <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">Voter</span>}
                        {resident.is_pwd && <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">PWD</span>}
                        {resident.is_senior && <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Senior</span>}
                        {resident.is_solo_parent && <span className="px-2 py-0.5 text-xs bg-pink-100 text-pink-700 rounded">Solo</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid={`edit-resident-${resident.id}`} onClick={() => openEdit(resident)}>
                          <Edit size={14} />
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`delete-resident-${resident.id}`} onClick={() => handleDelete(resident.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {residents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground" data-testid="no-residents-message">No residents found</div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
