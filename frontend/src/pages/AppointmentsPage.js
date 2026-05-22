import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Calendar, Clock, Trash2 } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
};

export const AppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ resident_id: '', purpose: '', appointment_date: '', appointment_time: '', notes: '' });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [a, r] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.appointments}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
      ]);
      setAppointments(a.data.appointments || []);
      setResidents(r.data.residents || []);
    } catch { toast.error('Failed to load'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.appointments}`, form, { withCredentials: true });
      toast.success('Appointment scheduled');
      setDialogOpen(false);
      setForm({ resident_id: '', purpose: '', appointment_date: '', appointment_time: '', notes: '' });
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.appointmentStatus(id)}?status=${status}`, {}, { withCredentials: true });
      toast.success('Updated');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    try {
      await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.appointmentById(id)}`, { withCredentials: true });
      toast.success('Deleted');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  return (
    <PageLayout testId="appointments-page">
      <PageHeader
        title="Appointments"
        description="Schedule and manage barangay appointments"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-appointment-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule Appointment</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label>Resident *</Label>
                  <Select value={form.resident_id} onValueChange={(v) => setForm({ ...form, resident_id: v })} required>
                    <SelectTrigger data-testid="appointment-resident-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {residents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Purpose *</Label>
                  <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date *</Label>
                    <Input type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Time *</Label>
                    <Input type="time" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="appointment-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">Schedule</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {appointments.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Calendar} title="No appointments scheduled" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.map((a) => (
            <Card key={a.id} className="p-6 hover:shadow-md transition-all" data-testid={`appointment-card-${a.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <div className="text-3xl font-heading font-bold">#{a.queue_number}</div>
                  <span className="text-xs text-muted-foreground">Queue</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[a.status] || STATUS_COLORS.scheduled}`}>
                  {a.status}
                </span>
              </div>
              <h3 className="font-semibold">{a.resident_name}</h3>
              <p className="text-sm text-primary mt-1">{a.purpose}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-3">
                <span className="flex items-center gap-1"><Calendar size={14} />{a.appointment_date}</span>
                <span className="flex items-center gap-1"><Clock size={14} />{a.appointment_time}</span>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                <Select value={a.status} onValueChange={(v) => handleStatusUpdate(a.id, v)}>
                  <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};
