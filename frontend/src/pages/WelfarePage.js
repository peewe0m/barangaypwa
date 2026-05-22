import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, UserCheck, Trash2 } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';

const PROGRAMS = [
  { value: 'senior', label: 'Senior Citizens' },
  { value: 'pwd', label: 'PWD' },
  { value: 'solo_parent', label: 'Solo Parent' },
  { value: '4ps', label: '4Ps Program' },
];

const ASSISTANCE_TYPES = ['Cash Assistance', 'Food Pack', 'Medical', 'Educational', 'Burial', 'Calamity', 'Other'];

export const WelfarePage = () => {
  const [records, setRecords] = useState([]);
  const [residents, setResidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('senior');
  const [form, setForm] = useState({
    resident_id: '', program_type: 'senior', assistance_type: 'Cash Assistance',
    amount: 0, description: '', date: '',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [w, r] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.welfareRecords}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
      ]);
      setRecords(w.data.records || []);
      setResidents(r.data.residents || []);
    } catch { toast.error('Failed to load data'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.welfareRecords}`, {
        ...form, amount: Number(form.amount) || 0,
      }, { withCredentials: true });
      toast.success('Welfare record added');
      setDialogOpen(false);
      setForm({ resident_id: '', program_type: 'senior', assistance_type: 'Cash Assistance', amount: 0, description: '', date: '' });
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    try {
      await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.welfareRecordById(id)}`, { withCredentials: true });
      toast.success('Deleted');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const filtered = records.filter((r) => r.program_type === activeTab);

  return (
    <PageLayout testId="welfare-page">
      <PageHeader
        title="Social Welfare"
        description="Manage assistance programs and beneficiaries"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-welfare-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Add Record
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Welfare Record</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label>Beneficiary *</Label>
                  <Select value={form.resident_id} onValueChange={(v) => setForm({ ...form, resident_id: v })} required>
                    <SelectTrigger data-testid="welfare-resident-select"><SelectValue placeholder="Select resident" /></SelectTrigger>
                    <SelectContent>
                      {residents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Program *</Label>
                    <Select value={form.program_type} onValueChange={(v) => setForm({ ...form, program_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROGRAMS.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assistance Type *</Label>
                    <Select value={form.assistance_type} onValueChange={(v) => setForm({ ...form, assistance_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSISTANCE_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount (₱)</Label>
                    <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Date *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="welfare-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">Save</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto">
          {PROGRAMS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} data-testid={`welfare-tab-${p.value}`}>{p.label}</TabsTrigger>
          ))}
        </TabsList>
        {PROGRAMS.map((p) => (
          <TabsContent key={p.value} value={p.value}>
            {filtered.length === 0 ? (
              <Card className="p-6"><EmptyState icon={UserCheck} title={`No ${p.label} records`} /></Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Beneficiary</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Assistance</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-accent/30">
                        <td className="px-6 py-4 font-medium">{r.resident_name}</td>
                        <td className="px-6 py-4 text-sm">{r.assistance_type}</td>
                        <td className="px-6 py-4 text-right font-semibold text-primary">₱{(r.amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{r.date}</td>
                        <td className="px-6 py-4">
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </PageLayout>
  );
};
