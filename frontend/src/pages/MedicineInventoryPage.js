import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { AlertTriangle, Box, Plus, Trash2, RefreshCcw, PackagePlus } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../config/modules';

const MED_CATEGORIES = ['Essential Medicines', 'Vaccines', 'Supplies', 'Other'];

const EMPTY_MEDICINE = {
  name: '',
  category: 'Essential Medicines',
  unit: 'pcs',
  reorder_threshold: 0,
};

const EMPTY_ADJUSTMENT = {
  operation: 'add', // add | subtract
  quantity: 0,
  reason: '',
  notes: '',
};

export const MedicineInventoryPage = () => {
  const { user } = useAuth();
  const adminUser = isAdminRole(user?.role);
  const { confirm, confirmDialog } = useConfirmAction();
  const [medicines, setMedicines] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [activeTab, setActiveTab] = useState('inventory');

  const [medicineForm, setMedicineForm] = useState(EMPTY_MEDICINE);

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustTargetId, setAdjustTargetId] = useState(null);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUSTMENT);

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.medicineInventory}`, { withCredentials: true });
      setMedicines(res.data.medicines || res.data.records || []);
    } catch {
      toast.error('Failed to load medicine inventory');
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeRefresh(fetchAll);

  const lowStockCount = useMemo(() => {
    return medicines.filter((m) => Number(m.quantity || 0) <= Number(m.reorder_threshold || 0) && Number(m.reorder_threshold || 0) > 0)
      .length;
  }, [medicines]);

  const openCreate = () => {
    setEditingId(null);
    setMedicineForm(EMPTY_MEDICINE);
    setDialogOpen(true);
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setMedicineForm({
      name: m.name || '',
      category: m.category || 'Essential Medicines',
      unit: m.unit || 'pcs',
      reorder_threshold: m.reorder_threshold ?? 0,
    });
    setDialogOpen(true);
  };

  const resetMedicineDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setMedicineForm(EMPTY_MEDICINE);
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...medicineForm,
        reorder_threshold: Number(medicineForm.reorder_threshold || 0),
      };

      if (editingId) {
        await axios.put(
          `${API_CONFIG.baseURL}${API_CONFIG.endpoints.medicineInventoryById(editingId)}`,
          payload,
          { withCredentials: true }
        );
        toast.success('Medicine updated');
      } else {
        await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.medicineInventory}`, payload, { withCredentials: true });
        toast.success('Medicine added');
      }

      resetMedicineDialog();
      fetchAll();
    } catch {
      toast.error('Failed to save medicine');
    }
  };

  const handleDelete = async (id) => {
    confirm({
      title: 'Delete inventory item?',
      description: 'This medicine inventory item will be hidden from active views.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.medicineInventoryById(id)}`, { withCredentials: true });
          toast.success('Deleted');
          fetchAll();
        } catch {
          toast.error('Failed to delete');
        }
      },
    });
  };

  const openAdjust = (id) => {
    setAdjustTargetId(id);
    setAdjustForm(EMPTY_ADJUSTMENT);
    setAdjustDialogOpen(true);
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        operation: adjustForm.operation,
        quantity: Number(adjustForm.quantity || 0),
        reason: adjustForm.reason || '',
        notes: adjustForm.notes || '',
      };

      await axios.post(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.medicineAdjust(adjustTargetId)}`,
        payload,
        { withCredentials: true }
      );

      toast.success('Stock updated');
      setAdjustDialogOpen(false);
      setAdjustTargetId(null);
      setAdjustForm(EMPTY_ADJUSTMENT);
      fetchAll();
    } catch {
      toast.error('Failed to update stock');
    }
  };

  return (
    <PageLayout testId="medicine-inventory-page">
      {confirmDialog}
      <PageHeader
        title="Medicine Inventory"
        description="Maintain medicine stock levels and adjustments"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-medicine-button" onClick={openCreate} className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" /> Add Medicine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveMedicine} className="space-y-4 mt-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={medicineForm.name}
                    onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })}
                    required
                    placeholder="e.g. Paracetamol"
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Select
                    value={medicineForm.category}
                    onValueChange={(v) => setMedicineForm({ ...medicineForm, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MED_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Unit</Label>
                    <Input
                      value={medicineForm.unit}
                      onChange={(e) => setMedicineForm({ ...medicineForm, unit: e.target.value })}
                      placeholder="pcs"
                    />
                  </div>
                  <div>
                    <Label>Reorder Threshold *</Label>
                    <Input
                      type="number"
                      value={medicineForm.reorder_threshold}
                      onChange={(e) => setMedicineForm({ ...medicineForm, reorder_threshold: e.target.value })}
                      required
                      min={0}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetMedicineDialog}>Cancel</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 hover:text-white">Save</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-2">
            Low Stock
            {lowStockCount > 0 && (
              <span className="inline-flex items-center justify-center text-xs bg-destructive text-white rounded-full px-2 py-0.5">
                {lowStockCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          {medicines.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon={PackagePlus} title="No medicines yet" description="Add medicines to start tracking stock" />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {medicines.map((m) => {
                const qty = Number(m.quantity || 0);
                const threshold = Number(m.reorder_threshold || 0);
                const isLow = threshold > 0 && qty <= threshold;

                return (
                  <Card key={m.id} className="p-5" data-testid={`medicine-card-${m.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Box size={16} className="text-primary" />
                          <h3 className="font-semibold">{m.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{m.category || 'Uncategorized'}</p>

                        <div className="mt-3">
                          <p className="text-sm font-medium">Stock: {qty} {m.unit || ''}</p>
                          <p className="text-xs text-muted-foreground mt-1">Reorder at: {threshold} {m.unit || ''}</p>
                        </div>

                        {isLow ? (
                          <div className="mt-3 flex items-center gap-2 text-destructive">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Low stock</span>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">Stock is sufficient</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button size="sm" variant="outline" onClick={() => openAdjust(m.id)} className="gap-2">
                          <RefreshCcw size={14} /> Adjust
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                          Edit
                        </Button>
                        {adminUser && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(m.id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="low-stock">
          {medicines.filter((m) => {
            const qty = Number(m.quantity || 0);
            const threshold = Number(m.reorder_threshold || 0);
            return threshold > 0 && qty <= threshold;
          }).length === 0 ? (
            <Card className="p-6">
              <EmptyState icon={AlertTriangle} title="No low-stock items" description="All medicines are above reorder thresholds" />
            </Card>
          ) : (
            <div className="space-y-4">
              {medicines
                .filter((m) => {
                  const qty = Number(m.quantity || 0);
                  const threshold = Number(m.reorder_threshold || 0);
                  return threshold > 0 && qty <= threshold;
                })
                .map((m) => {
                  const qty = Number(m.quantity || 0);
                  const threshold = Number(m.reorder_threshold || 0);
                  return (
                    <Card key={m.id} className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{m.name}</h3>
                          <p className="text-xs text-muted-foreground">Stock: {qty} {m.unit || ''} • Threshold: {threshold} {m.unit || ''}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openAdjust(m.id)}>
                          <RefreshCcw size={14} className="mr-2" /> Replenish
                        </Button>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAdjustment} className="space-y-4 mt-4">
            <div>
              <Label>Operation</Label>
              <Select value={adjustForm.operation} onValueChange={(v) => setAdjustForm({ ...adjustForm, operation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add stock (receive)</SelectItem>
                  <SelectItem value="subtract">Subtract stock (use/consume)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min={0}
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Reason</Label>
              <Input value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="e.g. Delivery batch / Consumption" />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 hover:text-white">Update</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

