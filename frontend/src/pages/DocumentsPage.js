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
import { Plus, Download, CheckCircle, PackageCheck, HandshakeIcon } from 'lucide-react';
import API_CONFIG from '../config/api';
import { SYSTEM_CONFIG } from '../config/system';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

export const DocumentsPage = () => {
  const [requests, setRequests] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Track rows that are dissolving (claimed but not yet removed from DOM)
  const [dissolving, setDissolving] = useState(new Set());
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

  const handleDownload = async (requestId, docType, docNumber) => {
    try {
      const response = await axios.get(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.downloadDocument(requestId)}`,
        { withCredentials: true, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docType}_${docNumber || requestId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Document downloaded — hand it to the requestor, then click Claimed');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const handleClaim = async (requestId) => {
    try {
      await axios.put(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.claimDocument(requestId)}`,
        {},
        { withCredentials: true }
      );
      // Start dissolve animation, then remove from list after it finishes
      setDissolving((prev) => new Set([...prev, requestId]));
      setTimeout(() => {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        setDissolving((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
      }, 600);
      toast.success('Document marked as claimed — request complete');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as claimed');
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

  // Split requests into buckets
  const forRelease = requests.filter((r) => r.status === 'released');
  const active = requests.filter((r) => !['released', 'claimed'].includes(r.status));
  const claimed = requests.filter((r) => r.status === 'claimed');

  const statusBadge = (status) => {
    const map = {
      pending:  'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      released: 'bg-purple-100 text-purple-700',
      rejected: 'bg-red-100 text-red-700',
      claimed:  'bg-green-100 text-green-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
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

        {/* ── FOR RELEASE section ───────────────────────────────────────── */}
        {forRelease.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <PackageCheck size={18} className="text-purple-600" />
              <h2 className="text-lg font-semibold text-purple-700">For Release</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                {forRelease.length}
              </span>
              <span className="text-xs text-muted-foreground">— PDF printed, hand to requestor then click Claimed</span>
            </div>

            <Card className="overflow-hidden border-purple-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Document #</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Resident</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Purpose</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Released At</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {forRelease.map((request) => (
                      <tr
                        key={request.id}
                        data-testid={`release-row-${request.id}`}
                        style={{
                          transition: 'opacity 0.5s ease, transform 0.5s ease, max-height 0.5s ease',
                          opacity: dissolving.has(request.id) ? 0 : 1,
                          transform: dissolving.has(request.id) ? 'translateX(40px)' : 'translateX(0)',
                        }}
                        className="bg-purple-50/40 hover:bg-purple-50"
                      >
                        <td className="px-6 py-4 font-medium text-sm">{request.document_number}</td>
                        <td className="px-6 py-4 text-sm font-medium">{getResidentName(request.resident_id)}</td>
                        <td className="px-6 py-4 text-sm">{request.document_type?.replace(/_/g, ' ')}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{request.purpose}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {request.downloaded_at ? new Date(request.downloaded_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`redownload-document-${request.id}`}
                              onClick={() => handleDownload(request.id, request.document_type, request.document_number)}
                              className="text-xs"
                            >
                              <Download size={13} className="mr-1" /> Re-print
                            </Button>
                            <Button
                              size="sm"
                              data-testid={`claim-document-${request.id}`}
                              onClick={() => handleClaim(request.id)}
                              className="bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                              disabled={dissolving.has(request.id)}
                            >
                              <HandshakeIcon size={13} /> Claimed
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── ACTIVE REQUESTS table ─────────────────────────────────────── */}
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">All Requests</h2>
          {claimed.length > 0 && (
            <span className="text-xs text-muted-foreground">· {claimed.length} claimed (hidden)</span>
          )}
        </div>
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
                {active.map((request) => (
                  <tr key={request.id} className="hover:bg-accent/50" data-testid={`document-row-${request.id}`}>
                    <td className="px-6 py-4 font-medium text-sm">{request.document_number}</td>
                    <td className="px-6 py-4 text-sm">{getResidentName(request.resident_id)}</td>
                    <td className="px-6 py-4 text-sm">{request.document_type?.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{request.purpose}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs rounded-full capitalize ${statusBadge(request.status)}`}
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
                            <CheckCircle size={14} className="mr-1" /> Approve
                          </Button>
                        )}
                        {request.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`download-document-${request.id}`}
                            onClick={() => handleDownload(request.id, request.document_type, request.document_number)}
                          >
                            <Download size={14} className="mr-1" /> Download
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {active.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground" data-testid="no-documents-message">
                No active document requests
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};