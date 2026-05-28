import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Edit, GitBranch, Home, MapPin, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../config/modules';

const EMPTY_FORM = {
  household_head_id: '',
  address: '',
  house_number: '',
  household_record_number: '',
  household_type: 'Nuclear Family',
  family_tree_group: '',
  purok: '',
  zone: '',
  street: '',
  landmark: '',
  latitude: '',
  longitude: '',
  notes: '',
};

export const HouseholdsPage = () => {
  const { user } = useAuth();
  const adminUser = isAdminRole(user?.role);
  const { confirm, confirmDialog } = useConfirmAction();
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [memberForm, setMemberForm] = useState({});

  const fetchAll = async () => {
    try {
      const [h, r] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.households}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
      ]);
      setHouseholds(h.data.households || []);
      setResidents(r.data.residents || []);
    } catch { toast.error('Failed to load data'); }
  };

  useEffect(() => { fetchAll(); }, []);
  useRealtimeRefresh(fetchAll);


  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (household) => {
    const mapping = household.address_mapping || {};
    setEditingId(household.id);
    setForm({
      ...EMPTY_FORM,
      ...household,
      purok: mapping.purok || '',
      zone: mapping.zone || '',
      street: mapping.street || '',
      landmark: mapping.landmark || '',
      latitude: mapping.latitude || '',
      longitude: mapping.longitude || '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      address_mapping: {
        purok: form.purok,
        zone: form.zone,
        street: form.street,
        landmark: form.landmark,
        latitude: form.latitude,
        longitude: form.longitude,
      },
    };

    try {
      if (editingId) {
        await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.householdById(editingId)}`, payload, { withCredentials: true });
        toast.success('Household updated');
      } else {
        await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.households}`, payload, { withCredentials: true });
        toast.success('Household created');
      }
      resetForm();
      fetchAll();
    } catch { toast.error('Failed to save household'); }
  };

  const handleDelete = async (id) => {
    confirm({
      title: 'Delete household?',
      description: 'This household record will be hidden from active views.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.householdById(id)}`, { withCredentials: true });
          toast.success('Deleted');
          fetchAll();
        } catch { toast.error('Failed to delete'); }
      },
    });
  };

  const handleAddMember = async (householdId) => {
    const selection = memberForm[householdId] || {};
    if (!selection.resident_id) return toast.error('Select a resident');

    try {
      await axios.put(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.addHouseholdMember(householdId, selection.resident_id)}`,
        {
          family_role: selection.family_role || 'Member',
          relationship_to_head: selection.relationship_to_head || '',
        },
        { withCredentials: true }
      );
      toast.success('Family member added');
      setMemberForm({ ...memberForm, [householdId]: {} });
      fetchAll();
    } catch { toast.error('Failed to add family member'); }
  };

  const handleRemoveMember = async (householdId, residentId) => {
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.removeHouseholdMember(householdId, residentId)}`, {}, { withCredentials: true });
      toast.success('Family member removed');
      fetchAll();
    } catch { toast.error('Failed to remove family member'); }
  };

  const unassignedResidents = residents.filter((resident) => !resident.household_id);

  return (
    <PageLayout testId="households-page">
      {confirmDialog}
      <PageHeader
        title="Households"
        description="Manage household records, family trees, members, and address mapping"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-household-button" onClick={openCreate} className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Add Household
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? 'Edit Household Record' : 'Create Household Record'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Household Head *</Label>
                    <Select value={form.household_head_id} onValueChange={(v) => setForm({ ...form, household_head_id: v })} required>
                      <SelectTrigger data-testid="household-head-select"><SelectValue placeholder="Select head of family" /></SelectTrigger>
                      <SelectContent>
                        {residents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Household Record No.</Label>
                    <Input value={form.household_record_number} onChange={(e) => setForm({ ...form, household_record_number: e.target.value })} placeholder="HH-2026-001" />
                  </div>
                  <div>
                    <Label>Household Type</Label>
                    <Select value={form.household_type} onValueChange={(v) => setForm({ ...form, household_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Nuclear Family', 'Extended Family', 'Single Parent', 'Solo Resident', 'Shared Household'].map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Family Tree Group</Label>
                    <Input value={form.family_tree_group} onChange={(e) => setForm({ ...form, family_tree_group: e.target.value })} placeholder="e.g. Santos Lineage A" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Address *</Label>
                    <Input data-testid="household-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                  </div>
                  <div>
                    <Label>House Number</Label>
                    <Input value={form.house_number} onChange={(e) => setForm({ ...form, house_number: e.target.value })} />
                  </div>
                  <div>
                    <Label>Street</Label>
                    <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                  </div>
                  <div>
                    <Label>Purok</Label>
                    <Input value={form.purok} onChange={(e) => setForm({ ...form, purok: e.target.value })} />
                  </div>
                  <div>
                    <Label>Zone</Label>
                    <Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Landmark</Label>
                    <Input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Latitude</Label>
                      <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button type="submit" data-testid="household-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                    {editingId ? 'Save Changes' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {households.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Home} title="No households yet" description="Add your first household to get started" /></Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {households.map((h) => {
            const mapping = h.address_mapping || {};
            const selection = memberForm[h.id] || {};

            return (
              <Card key={h.id} className="p-6 hover:shadow-md transition-all duration-300" data-testid={`household-card-${h.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-lg bg-accent"><Home className="text-primary" size={24} /></div>
                    <div>
                      <h3 className="font-heading font-semibold text-lg">{h.household_record_number || h.household_head_name}</h3>
                      <p className="text-sm text-muted-foreground">Head: {h.household_head_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(h)} data-testid={`edit-household-${h.id}`}>
                      <Edit size={14} />
                    </Button>
                    {adminUser && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(h.id)} data-testid={`delete-household-${h.id}`}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-2 text-sm font-medium"><Users size={14} /> Household Record</div>
                    <p className="text-xs text-muted-foreground mt-1">{h.household_type || 'No type set'}</p>
                    <p className="text-xs text-muted-foreground">House #: {h.house_number || 'N/A'}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-2 text-sm font-medium"><GitBranch size={14} /> Family Tree</div>
                    <p className="text-xs text-muted-foreground mt-1">{h.family_tree_group || 'No tree group set'}</p>
                    <p className="text-xs text-muted-foreground">{h.member_count || 0} member(s)</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-2 text-sm font-medium"><MapPin size={14} /> Address Mapping</div>
                    <p className="text-xs text-muted-foreground mt-1">{[mapping.purok, mapping.zone, mapping.street].filter(Boolean).join(' / ') || 'No mapped area'}</p>
                    <p className="text-xs text-muted-foreground">{mapping.landmark || h.address}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <h4 className="text-sm font-semibold mb-2">Family Members</h4>
                  <div className="space-y-2">
                    {(h.members || []).map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[member.family_role || 'Member', member.relationship_to_head].filter(Boolean).join(' / ')}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(h.id, member.id)}>
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                    {(!h.members || h.members.length === 0) && (
                      <p className="text-sm text-muted-foreground">No family members assigned yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_140px_1fr_auto] gap-2 items-end">
                  <div>
                    <Label>Add Family Member</Label>
                    <Select
                      value={selection.resident_id || 'none'}
                      onValueChange={(v) => setMemberForm({ ...memberForm, [h.id]: { ...selection, resident_id: v === 'none' ? '' : v } })}
                    >
                      <SelectTrigger data-testid={`household-member-select-${h.id}`}><SelectValue placeholder="Select resident" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select resident</SelectItem>
                        {unassignedResidents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select
                      value={selection.family_role || 'Member'}
                      onValueChange={(v) => setMemberForm({ ...memberForm, [h.id]: { ...selection, family_role: v } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Spouse', 'Child', 'Parent', 'Sibling', 'Relative', 'Boarder', 'Member'].map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Relationship</Label>
                    <Input
                      value={selection.relationship_to_head || ''}
                      onChange={(e) => setMemberForm({ ...memberForm, [h.id]: { ...selection, relationship_to_head: e.target.value } })}
                      placeholder="e.g. Son"
                    />
                  </div>
                  <Button type="button" onClick={() => handleAddMember(h.id)} className="bg-primary hover:bg-primary/90 hover:text-white">
                    <UserPlus size={16} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};
