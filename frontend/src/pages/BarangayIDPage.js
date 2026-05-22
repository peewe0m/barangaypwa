import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Plus, IdCard, Download, Trash2, QrCode } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';

export const BarangayIDPage = () => {
  const [ids, setIds] = useState([]);
  const [residents, setResidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [i, r] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.barangayIds}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
      ]);
      setIds(i.data.ids || []);
      setResidents(r.data.residents || []);
    } catch { toast.error('Failed'); }
  };

  const handleGenerate = async () => {
    if (!selectedResident) return toast.error('Select a resident');
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.barangayIds}`,
        { resident_id: selectedResident }, { withCredentials: true });
      toast.success('Barangay ID generated');
      setDialogOpen(false);
      setSelectedResident('');
      fetchAll();
    } catch { toast.error('Failed to generate'); }
  };

  const handleDownload = async (id, idNumber) => {
    try {
      const response = await axios.get(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.downloadBarangayId(id)}`,
        { withCredentials: true, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `barangay_id_${idNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded');
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ID?')) return;
    try {
      await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.barangayIdById(id)}`, { withCredentials: true });
      toast.success('Deleted');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  return (
    <PageLayout testId="barangay-id-page">
      <PageHeader
        title="Barangay ID System"
        description="Generate official Barangay ID cards with QR verification"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="generate-id-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Generate ID
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate Barangay ID</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Select Resident *</Label>
                  <Select value={selectedResident} onValueChange={setSelectedResident}>
                    <SelectTrigger data-testid="id-resident-select"><SelectValue placeholder="Choose resident" /></SelectTrigger>
                    <SelectContent>
                      {residents.map((r) => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Upload a photo from the Residents page to include it on the ID card.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleGenerate} data-testid="id-generate-confirm" className="bg-primary hover:bg-primary/90 hover:text-white">Generate</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {ids.length === 0 ? (
        <Card className="p-6"><EmptyState icon={IdCard} title="No Barangay IDs generated yet" description="Generate IDs for residents to access barangay services" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ids.map((id) => (
            <Card key={id.id} className="overflow-hidden hover:shadow-lg transition-all" data-testid={`barangay-id-card-${id.id}`}>
              <div className="bg-primary text-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-white/80">Barangay ID</p>
                  <QrCode size={20} className="text-white/80" />
                </div>
                <h3 className="text-lg font-heading font-bold mt-1">{id.resident_name}</h3>
                <p className="text-xs text-white/80 mt-1">#{id.id_number}</p>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Issued:</span> {new Date(id.issue_date).toLocaleDateString()}</p>
                <p><span className="text-muted-foreground">Expires:</span> {new Date(id.expiry_date).toLocaleDateString()}</p>
                <p><span className="text-muted-foreground">Status:</span> <span className="capitalize text-green-700 font-medium">{id.status}</span></p>
              </div>
              <div className="flex gap-2 p-4 pt-0">
                <Button size="sm" variant="outline" onClick={() => handleDownload(id.id, id.id_number)} data-testid={`download-id-${id.id}`} className="flex-1">
                  <Download size={14} className="mr-1" /> Print ID
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(id.id)}><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};
