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
import { Plus, AlertCircle, Trash2 } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../config/modules';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  mediation: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const INCIDENT_TYPES = ['Noise Complaint', 'Property Dispute', 'Verbal Altercation', 'Physical Altercation', 'Theft', 'Domestic Issue', 'Public Disturbance', 'Other'];

export const BlotterPage = () => {
  const { user } = useAuth();
  const adminUser = isAdminRole(user?.role);
  const { confirm, confirmDialog } = useConfirmAction();
  const [blotters, setBlotters] = useState([]);
  const [residents, setResidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    complainant_id: '', respondent_name: '', incident_type: 'Noise Complaint',
    incident_date: '', incident_location: '', description: '', status: 'pending',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [b, r] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.blotters}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
      ]);
      setBlotters(b.data.blotters || []);
      setResidents(r.data.residents || []);
    } catch { toast.error('Failed to load data'); }
  };

  useRealtimeRefresh(fetchAll);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.blotters}`, form, { withCredentials: true });
      toast.success('Blotter case recorded');
      setDialogOpen(false);
      setForm({ complainant_id: '', respondent_name: '', incident_type: 'Noise Complaint', incident_date: '', incident_location: '', description: '', status: 'pending' });
      fetchAll();
    } catch { toast.error('Failed to record blotter'); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.blotterById(id)}`, { status: newStatus }, { withCredentials: true });
      toast.success('Status updated');
      fetchAll();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    confirm({
      title: 'Delete blotter?',
      description: 'This incident record will be hidden from active views.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.blotterById(id)}`, { withCredentials: true });
          toast.success('Deleted');
          fetchAll();
        } catch { toast.error('Failed to delete'); }
      },
    });
  };

  return (
    <PageLayout testId="blotter-page">
      {confirmDialog}
      <PageHeader
        title="Blotter Management"
        description="Record and manage barangay incidents and complaints"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-blotter-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Record Incident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Record New Blotter Case</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label>Complainant *</Label>
                  <Select value={form.complainant_id} onValueChange={(v) => setForm({ ...form, complainant_id: v })} required>
                    <SelectTrigger data-testid="blotter-complainant-select"><SelectValue placeholder="Select complainant" /></SelectTrigger>
                    <SelectContent>
                      {residents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Respondent Name *</Label>
                  <Input data-testid="blotter-respondent-input" value={form.respondent_name} onChange={(e) => setForm({ ...form, respondent_name: e.target.value })} required />
                </div>
                <div>
                  <Label>Incident Type *</Label>
                  <Select value={form.incident_type} onValueChange={(v) => setForm({ ...form, incident_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Incident Date *</Label>
                    <Input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Location *</Label>
                    <Input value={form.incident_location} onChange={(e) => setForm({ ...form, incident_location: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea data-testid="blotter-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="blotter-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">Record</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {blotters.length === 0 ? (
        <Card className="p-6"><EmptyState icon={AlertCircle} title="No blotter cases yet" description="Record your first incident to begin tracking" /></Card>
      ) : (
        <div className="space-y-4">
          {blotters.map((b) => (
            <Card key={b.id} className="p-6 hover:shadow-md transition-all duration-300" data-testid={`blotter-card-${b.id}`}>
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-heading font-semibold text-lg">{b.case_number}</h3>
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{b.incident_type} • {b.incident_location}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={b.status} onValueChange={(v) => handleStatusChange(b.id, v)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="mediation">Mediation</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  {adminUser && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)} data-testid={`delete-blotter-${b.id}`}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mt-3">
                <p><span className="text-muted-foreground">Complainant:</span> <span className="font-medium">{b.complainant_name || '—'}</span></p>
                <p><span className="text-muted-foreground">Respondent:</span> <span className="font-medium">{b.respondent_name}</span></p>
              </div>
              <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">{b.description}</p>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};
