import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, DollarSign, Receipt, Trash2 } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { SYSTEM_CONFIG } from '../config/system';

export const PaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ resident_id: '', amount: 0, payment_for: 'document', payment_method: 'cash' });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [p, r] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.payments}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
      ]);
      setPayments(p.data.payments || []);
      setTotalRevenue(p.data.total_revenue || 0);
      setResidents(r.data.residents || []);
    } catch { toast.error('Failed'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.payments}`, {
        ...form, amount: Number(form.amount) || 0,
      }, { withCredentials: true });
      toast.success('Payment recorded');
      setDialogOpen(false);
      setForm({ resident_id: '', amount: 0, payment_for: 'document', payment_method: 'cash' });
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    try {
      await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.paymentById(id)}`, { withCredentials: true });
      toast.success('Deleted');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  return (
    <PageLayout testId="payments-page">
      <PageHeader
        title="Payments & Collections"
        description="Manage payments and official receipts"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-payment-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label>Payer (Resident)</Label>
                  <Select value={form.resident_id} onValueChange={(v) => setForm({ ...form, resident_id: v })}>
                    <SelectTrigger data-testid="payment-resident-select"><SelectValue placeholder="Select payer" /></SelectTrigger>
                    <SelectContent>
                      {residents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount (₱) *</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Payment For *</Label>
                    <Select value={form.payment_for} onValueChange={(v) => setForm({ ...form, payment_for: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="document">Document</SelectItem>
                        <SelectItem value="business_permit">Business Permit</SelectItem>
                        <SelectItem value="barangay_id">Barangay ID</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Method *</Label>
                    <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="gcash">GCash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="payment-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">Record</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 bg-primary text-white">
          <p className="text-sm text-white/80 uppercase tracking-wide">Total Revenue</p>
          <h3 className="text-3xl font-heading font-bold mt-2">₱{totalRevenue.toLocaleString()}</h3>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Transactions</p>
          <h3 className="text-3xl font-heading font-bold mt-2 text-primary">{payments.length}</h3>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Document Fee</p>
          <h3 className="text-3xl font-heading font-bold mt-2 text-primary">₱{SYSTEM_CONFIG.documentFees.barangay_clearance}</h3>
        </Card>
      </div>

      {payments.length === 0 ? (
        <Card className="p-6"><EmptyState icon={DollarSign} title="No payments recorded yet" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Receipt #</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Payer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase">For</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Method</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Date</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-accent/30">
                  <td className="px-6 py-4 font-mono text-xs flex items-center gap-2"><Receipt size={14} />{p.receipt_number}</td>
                  <td className="px-6 py-4">{p.resident_name || '—'}</td>
                  <td className="px-6 py-4 text-sm capitalize">{p.payment_for?.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-sm capitalize">{p.payment_method}</td>
                  <td className="px-6 py-4 text-right font-semibold text-primary">₱{(p.amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4"><Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageLayout>
  );
};
