import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Heart, Syringe, Stethoscope, Baby, Trash2 } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../config/modules';

const NO_MEDICINE = 'no-medicine';

const RECORD_TYPES = [
  { value: 'vaccination', label: 'Vaccination', icon: Syringe },
  { value: 'medical', label: 'Medical Assistance', icon: Stethoscope },
  { value: 'prenatal', label: 'Prenatal Care', icon: Baby },
];

export const HealthPage = () => {
  const { user } = useAuth();
  const adminUser = isAdminRole(user?.role);
  const { confirm, confirmDialog } = useConfirmAction();
  const [records, setRecords] = useState([]);
  const [residents, setResidents] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('vaccination');
  const [form, setForm] = useState({
    resident_id: '', record_type: 'vaccination', description: '',
    date: '', notes: '', medication: '', medicine_id: '', medicine_quantity: 1,
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [h, r, m] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.healthRecords}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.medicineInventory}`, { withCredentials: true }),
      ]);
      setRecords(h.data.records || []);
      setResidents(r.data.residents || []);
      setMedicines(m.data.medicines || []);
    } catch { toast.error('Failed to load data'); }
  };

  useRealtimeRefresh(fetchAll);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.healthRecords}`, form, { withCredentials: true });
      toast.success('Record added');
      setDialogOpen(false);
      setForm({ resident_id: '', record_type: 'vaccination', description: '', date: '', notes: '', medication: '', medicine_id: '', medicine_quantity: 1 });
      fetchAll();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to add record');
    }
  };

  const handleDelete = async (id) => {
    confirm({
      title: 'Delete health record?',
      description: 'This health record will be hidden from active views.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.healthRecordById(id)}`, { withCredentials: true });
          toast.success('Deleted');
          fetchAll();
        } catch { toast.error('Failed to delete'); }
      },
    });
  };

  const filtered = records.filter((r) => r.record_type === activeTab);

  return (
    <PageLayout testId="health-page">
      {confirmDialog}
      <PageHeader
        title="Health Records"
        description="Manage vaccination, medical, prenatal records, and medicine inventory"
        action={
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="bg-white/5 text-white border-white/10"
              onClick={() => window.location.assign('/medicine-inventory')}
            >
              Medicine Inventory
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  data-testid="add-health-button"
                  className="bg-primary hover:bg-primary/90 hover:text-white"
                  onClick={() => setForm((current) => ({ ...current, record_type: activeTab }))}
                >
                  <Plus size={16} className="mr-2" /> Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Add Health Record</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div>
                    <Label>Resident *</Label>
                    <Select
                      value={form.resident_id}
                      onValueChange={(v) => setForm({ ...form, resident_id: v })}
                      required
                    >
                      <SelectTrigger data-testid="health-resident-select">
                        <SelectValue placeholder="Select resident" />
                      </SelectTrigger>
                      <SelectContent>
                        {residents.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Record Type *</Label>
                    <Select
                      value={form.record_type}
                      onValueChange={(v) => setForm({ ...form, record_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECORD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Description *</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      required
                      placeholder="e.g. COVID-19 Booster, BP Check, etc."
                    />
                  </div>

                  <div>
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Medication/Treatment</Label>
                    <Input
                      value={form.medication}
                      onChange={(e) => setForm({ ...form, medication: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
                    <div>
                      <Label>Medicine Inventory</Label>
                      <Select
                        value={form.medicine_id || NO_MEDICINE}
                        onValueChange={(v) => setForm({
                          ...form,
                          medicine_id: v === NO_MEDICINE ? '' : v,
                          medicine_quantity: v === NO_MEDICINE ? 1 : form.medicine_quantity,
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select medicine" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_MEDICINE}>No medicine used</SelectItem>
                          {medicines.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} ({Number(m.quantity || 0)} {m.unit || 'pcs'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.medicine_quantity}
                        disabled={!form.medicine_id}
                        onChange={(e) => setForm({ ...form, medicine_quantity: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      data-testid="health-submit-button"
                      className="bg-primary hover:bg-primary/90 hover:text-white"
                    >
                      Save
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          {RECORD_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} data-testid={`health-tab-${t.value}`}>
                <Icon size={16} className="mr-2" /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {RECORD_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {filtered.length === 0 ? (
              <Card className="p-6"><EmptyState icon={Heart} title={`No ${t.label.toLowerCase()} records`} /></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((r) => (
                  <Card key={r.id} className="p-5" data-testid={`health-card-${r.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{r.resident_name}</h3>
                        <p className="text-sm text-primary mt-1 font-medium">{r.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{r.date}</p>
                        {r.medication && <p className="text-sm mt-2"><span className="text-muted-foreground">Medication:</span> {r.medication}</p>}
                        {r.medicine_name && (
                          <p className="text-sm mt-2">
                            <span className="text-muted-foreground">Inventory used:</span> {r.medicine_quantity} {r.medicine_unit} {r.medicine_name}
                          </p>
                        )}
                        {r.notes && <p className="text-sm text-muted-foreground mt-2">{r.notes}</p>}
                      </div>
                      {adminUser && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </PageLayout>
  );
};
