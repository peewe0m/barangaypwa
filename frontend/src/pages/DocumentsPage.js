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
import { Plus, Download, CheckCircle } from 'lucide-react';
import API_CONFIG from '../config/api';
import { SYSTEM_CONFIG } from '../config/system';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

export const DocumentsPage = () => {
  const [requests, setRequests] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    resident_id: '',
    document_type: 'barangay_clearance',
    purpose: '',
    additional_details: {},
  });

  useEffect(() => {
    fetchRequests();
    fetchResidents();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await axios.get(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.documentRequests}`,
        { withCredentials: true }
      );
      setRequests(data.requests || []);
    } catch (error) {
      toast.error('Failed to load document requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async () => {
    try {
      const { data } = await axios.get(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`,
        { withCredentials: true }
      );
      setResidents(data.residents || []);
    } catch (error) {
      console.error('Failed to load residents');
    }
  };

  useRealtimeRefresh(() => {
    fetchRequests();
    fetchResidents();
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.documentRequests}`,
        formData,
        { withCredentials: true }
      );
      toast.success('Document request created successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchRequests();
    } catch (error) {
      toast.error('Failed to create document request');
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await axios.put(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.approveDocument(requestId)}`,
        {},
        { withCredentials: true }
      );
      toast.success('Document approved successfully');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to approve document');
    }
  };

  const handleDownload = async (requestId, docType) => {
    try {
      const response = await axios.get(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.downloadDocument(requestId)}`,
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docType}_${requestId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Document downloaded');
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const resetForm = () => {
    setFormData({
      resident_id: '',
      document_type: 'barangay_clearance',
      purpose: '',
      additional_details: {},
    });
  };

  const getResidentName = (residentId) => {
    const resident = residents.find((r) => r.id === residentId);
    return resident ? resident.full_name : 'Unknown';
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 md:p-8" data-testid="documents-page">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold text-primary">Document Requests</h1>
            <p className="text-muted-foreground mt-2">Manage barangay document requests</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-document-request-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                <Plus size={16} className="mr-2" />
                Create Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Document Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="resident_id">Select Resident *</Label>
                  <Select
                    value={formData.resident_id}
                    onValueChange={(value) => setFormData({ ...formData, resident_id: value })}
                    required
                  >
                    <SelectTrigger data-testid="document-resident-select">
                      <SelectValue placeholder="Select a resident" />
                    </SelectTrigger>
                    <SelectContent>
                      {residents.map((resident) => (
                        <SelectItem key={resident.id} value={resident.id}>
                          {resident.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="document_type">Document Type *</Label>
                  <Select
                    value={formData.document_type}
                    onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                  >
                    <SelectTrigger data-testid="document-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_CONFIG.documentTypes.map((doc) => (
                        <SelectItem key={doc.value} value={doc.value}>
                          {doc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="purpose">Purpose *</Label>
                  <Input
                    id="purpose"
                    data-testid="document-purpose-input"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    placeholder="e.g., Employment, Local Employment, etc."
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="document-submit-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                    Create Request
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Document Requests Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="documents-table">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Document #</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Resident</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Purpose</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-accent/50" data-testid={`document-row-${request.id}`}>
                    <td className="px-6 py-4 font-medium text-sm">{request.document_number}</td>
                    <td className="px-6 py-4 text-sm">{getResidentName(request.resident_id)}</td>
                    <td className="px-6 py-4 text-sm">
                      {request.document_type?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{request.purpose}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs rounded-full ${
                          request.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                        data-testid={`document-status-${request.id}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            data-testid={`approve-document-${request.id}`}
                            onClick={() => handleApprove(request.id)}
                            className="bg-primary hover:bg-primary/90 hover:text-white"
                          >
                            <CheckCircle size={14} className="mr-1" />
                            Approve
                          </Button>
                        )}
                        {request.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`download-document-${request.id}`}
                            onClick={() => handleDownload(request.id, request.document_type)}
                          >
                            <Download size={14} className="mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {requests.length === 0 && (
              <div className="text-center py-12 text-muted-foreground" data-testid="no-documents-message">
                No document requests found
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
