import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import API_CONFIG from '../config/api';
import { SYSTEM_CONFIG } from '../config/system';

export const ResidentsPage = () => {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    address: '',
    birthdate: '',
    gender: 'Male',
    civil_status: 'Single',
    citizenship: 'Filipino',
    contact_number: '',
    occupation: '',
    email: '',
    religion: 'Roman Catholic',
    is_voter: false,
    is_pwd: false,
    is_senior: false,
    is_solo_parent: false,
    emergency_contact: '',
  });

  useEffect(() => {
    fetchResidents();
  }, [searchQuery]);

  const fetchResidents = async () => {
    try {
      const params = searchQuery ? { search: searchQuery } : {};
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, {
        params,
        withCredentials: true,
      });
      setResidents(data.residents || []);
    } catch (error) {
      toast.error('Failed to load residents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, formData, {
        withCredentials: true,
      });
      toast.success('Resident added successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchResidents();
    } catch (error) {
      toast.error('Failed to add resident');
    }
  };

  const handleDelete = async (residentId) => {
    if (!window.confirm('Are you sure you want to delete this resident?')) return;
    
    try {
      await axios.delete(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.residentById(residentId)}`,
        { withCredentials: true }
      );
      toast.success('Resident deleted successfully');
      fetchResidents();
    } catch (error) {
      toast.error('Failed to delete resident');
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      address: '',
      birthdate: '',
      gender: 'Male',
      civil_status: 'Single',
      citizenship: 'Filipino',
      contact_number: '',
      occupation: '',
      email: '',
      religion: 'Roman Catholic',
      is_voter: false,
      is_pwd: false,
      is_senior: false,
      is_solo_parent: false,
      emergency_contact: '',
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 md:p-8" data-testid="residents-page">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold text-primary">Residents</h1>
            <p className="text-muted-foreground mt-2">Manage barangay residents</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-resident-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" />
                Add Resident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Resident</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      data-testid="resident-fullname-input"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      data-testid="resident-address-input"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="birthdate">Birthdate *</Label>
                    <Input
                      id="birthdate"
                      type="date"
                      data-testid="resident-birthdate-input"
                      value={formData.birthdate}
                      onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender">Gender *</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger data-testid="resident-gender-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_CONFIG.gender.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="civil_status">Civil Status *</Label>
                    <Select
                      value={formData.civil_status}
                      onValueChange={(value) => setFormData({ ...formData, civil_status: value })}
                    >
                      <SelectTrigger data-testid="resident-civilstatus-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_CONFIG.civilStatus.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="contact_number">Contact Number</Label>
                    <Input
                      id="contact_number"
                      data-testid="resident-contact-input"
                      value={formData.contact_number}
                      onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      data-testid="resident-occupation-input"
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="resident-email-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2 flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        data-testid="resident-voter-checkbox"
                        checked={formData.is_voter}
                        onChange={(e) => setFormData({ ...formData, is_voter: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Registered Voter</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        data-testid="resident-pwd-checkbox"
                        checked={formData.is_pwd}
                        onChange={(e) => setFormData({ ...formData, is_pwd: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">PWD</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        data-testid="resident-senior-checkbox"
                        checked={formData.is_senior}
                        onChange={(e) => setFormData({ ...formData, is_senior: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Senior Citizen</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        data-testid="resident-solo-parent-checkbox"
                        checked={formData.is_solo_parent}
                        onChange={(e) => setFormData({ ...formData, is_solo_parent: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Solo Parent</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="resident-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                    Add Resident
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              data-testid="residents-search-input"
              placeholder="Search by name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Residents Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="residents-table">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Gender</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {residents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-accent/50" data-testid={`resident-row-${resident.id}`}>
                    <td className="px-6 py-4 font-medium">{resident.full_name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{resident.address}</td>
                    <td className="px-6 py-4 text-sm">{resident.age}</td>
                    <td className="px-6 py-4 text-sm">{resident.gender}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-1">
                        {resident.is_voter && <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded">Voter</span>}
                        {resident.is_pwd && <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">PWD</span>}
                        {resident.is_senior && <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">Senior</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`delete-resident-${resident.id}`}
                          onClick={() => handleDelete(resident.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {residents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground" data-testid="no-residents-message">
                No residents found
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
