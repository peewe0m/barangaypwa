import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Globe, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

export const PortalRequestsPage = () => {
  const [requests, setRequests] = useState([]);

  const resolvePhotoUrl = (request) => {
    const privateUrl = API_CONFIG.privateFileURL(request.photo_attachment?.storage);
    if (privateUrl) return privateUrl;
    if (/^https?:\/\//i.test(request.photo_url || '')) return request.photo_url;
    return '';
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.portalRequests}`, { withCredentials: true });
      setRequests(data.requests || []);
    } catch { toast.error('Failed'); }
  };

  useRealtimeRefresh(fetchAll);

  const handleProcess = async (id) => {
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.processPortalRequest(id)}`, {}, { withCredentials: true });
      toast.success('Request marked as processed');
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process request');
    }
  };

  return (
    <PageLayout testId="portal-requests-page">
      <PageHeader title="Online Requests" description="Requests submitted via resident portal" />

      {requests.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Globe} title="No online requests yet" description="Share your portal URL with residents" /></Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id} className="p-6" data-testid={`portal-request-card-${r.id}`}>
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-mono font-semibold text-primary">{r.tracking_number}</p>
                    <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${
                      r.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {r.status === 'processed' ? <CheckCircle2 size={12} className="inline mr-1" /> : <Clock size={12} className="inline mr-1" />}
                      {r.status}
                    </span>
                  </div>
                  <h3 className="font-heading font-semibold mt-2">{r.full_name}</h3>
                </div>
                {r.status !== 'processed' && (
                  <Button size="sm" onClick={() => handleProcess(r.id)} data-testid={`process-${r.id}`} className="bg-primary hover:bg-primary/90 hover:text-white">
                    Mark Processed
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mt-3">
                <p><span className="text-muted-foreground">Document:</span> {r.document_type?.replace(/_/g, ' ')}</p>
                <p><span className="text-muted-foreground">Purpose:</span> {r.purpose}</p>
                <p><span className="text-muted-foreground">Email:</span> {r.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {r.contact_number}</p>
                <p className="md:col-span-2"><span className="text-muted-foreground">Address:</span> {r.address}</p>
                {resolvePhotoUrl(r) && (
                  <div className="md:col-span-2 mt-2">
                    <p className="text-muted-foreground mb-2">Attached Photo:</p>
                    <a href={resolvePhotoUrl(r)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                      <ImageIcon size={16} /> View captured applicant photo
                    </a>
                  </div>
                )}
                <p className="md:col-span-2 text-xs text-muted-foreground">Submitted: {new Date(r.created_at).toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};
