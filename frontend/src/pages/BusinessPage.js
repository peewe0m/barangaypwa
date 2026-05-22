import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Briefcase, RefreshCw, Trash2 } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';

const BUSINESS_TYPES = ['Retail', 'Service', 'Food & Beverage', 'Manufacturing', 'Wholesale', 'Other'];

export const BusinessPage = () => {
  const [businesses, setBusinesses] = useState([]);
  const [residents, setResidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    business_name: '', owner_id: '', business_type: 'Retail',
    address: '', contact_number: '', capitalization: 0, employees_count: 0,
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [b, r] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.businesses}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
      ]);
      setBusinesses(b.data.businesses || []);
      setResidents(r.data.residents || []);
    } catch { toast.error('Failed to load data'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.businesses}`, {
        ...form,
        capitalization: Number(form.capitalization) || 0,
        employees_count: Number(form.employees_count) || 0,
      }, { withCredentials: true });
      toast.success('Business registered');
      setDialogOpen(false);
      setForm({ business_name: '', owner_id: '', business_type: 'Retail', address: '', contact_number: '', capitalization: 0, employees_count: 0 });
      fetchAll();
    } catch { toast.error('Failed to register business'); }
  };

  const handleRenew = async (id) => {
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.renewBusiness(id)}`, {}, { withCredentials: true });
      toast.success('Permit renewed');
      fetchAll();
    } catch { toast.error('Failed to renew'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this business?')) return;
    try {
      await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.businessById(id)}`, { withCredentials: true });
      toast.success('Deleted');
      fetchAll();
    } catch { toast.error('Failed to delete'); }
  };

  const isExpired = (expiry) => new Date(expiry) < new Date();

  return (
    <PageLayout testId="business-page">
      <PageHeader
        title="Business Clearance"
        description="Manage business permits and renewals"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-business-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Register Business
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Register New Business</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label>Business Name *</Label>
                  <Input data-testid="business-name-input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} required />
                </div>
                <div>
                  <Label>Owner *</Label>
                  <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })} required>
                    <SelectTrigger data-testid="business-owner-select"><SelectValue placeholder="Select owner" /></SelectTrigger>
                    <SelectContent>
                      {residents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Business Type *</Label>
                    <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Contact Number</Label>
                    <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Address *</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Capitalization (₱)</Label>
                    <Input type="number" value={form.capitalization} onChange={(e) => setForm({ ...form, capitalization: e.target.value })} />
                  </div>
                  <div>
                    <Label>Employees</Label>
                    <Input type="number" value={form.employees_count} onChange={(e) => setForm({ ...form, employees_count: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="business-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">Register</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {businesses.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Briefcase} title="No businesses registered" description="Register your first business" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.map((b) => (
            <Card key={b.id} className="p-6 hover:shadow-md transition-all duration-300" data-testid={`business-card-${b.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 rounded-lg bg-accent"><Briefcase className="text-primary" size={24} /></div>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${isExpired(b.expiry_date) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {isExpired(b.expiry_date) ? 'Expired' : 'Active'}
                </span>
              </div>
              <h3 className="font-heading font-semibold text-lg">{b.business_name}</h3>
              <p className="text-xs text-muted-foreground mt-1">#{b.permit_number}</p>
              <div className="mt-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Owner:</span> {b.owner_name}</p>
                <p><span className="text-muted-foreground">Type:</span> {b.business_type}</p>
                <p><span className="text-muted-foreground">Expires:</span> {new Date(b.expiry_date).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="outline" onClick={() => handleRenew(b.id)} data-testid={`renew-business-${b.id}`} className="flex-1">
                  <RefreshCw size={14} className="mr-1" /> Renew
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};
