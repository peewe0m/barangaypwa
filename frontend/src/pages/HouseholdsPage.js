import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Home, Trash2, Users } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';

export const HouseholdsPage = () => {
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ household_head_id: '', address: '', house_number: '', notes: '' });

  useEffect(() => { fetchAll(); }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.households}`, form, { withCredentials: true });
      toast.success('Household created');
      setDialogOpen(false);
      setForm({ household_head_id: '', address: '', house_number: '', notes: '' });
      fetchAll();
    } catch { toast.error('Failed to create household'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this household?')) return;
    try {
      await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.householdById(id)}`, { withCredentials: true });
      toast.success('Deleted');
      fetchAll();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <PageLayout testId="households-page">
      <PageHeader
        title="Households"
        description="Manage household records and family groupings"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-household-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Add Household
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Household</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                  <Label>Address *</Label>
                  <Input data-testid="household-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                </div>
                <div>
                  <Label>House Number</Label>
                  <Input value={form.house_number} onChange={(e) => setForm({ ...form, house_number: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="household-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">Create</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {households.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Home} title="No households yet" description="Add your first household to get started" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {households.map((h) => (
            <Card key={h.id} className="p-6 hover:shadow-md transition-all duration-300" data-testid={`household-card-${h.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 rounded-lg bg-accent"><Home className="text-primary" size={24} /></div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(h.id)} data-testid={`delete-household-${h.id}`}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <h3 className="font-heading font-semibold text-lg">{h.household_head_name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{h.address}</p>
              {h.house_number && <p className="text-xs text-muted-foreground mt-1">House #: {h.house_number}</p>}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                <Users size={14} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{h.member_count || 0} member(s)</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};
