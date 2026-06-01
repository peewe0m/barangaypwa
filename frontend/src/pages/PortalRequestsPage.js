import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Globe, CheckCircle2, Clock, Image as ImageIcon, Play, Link2, FileCheck, Package } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

/**
 * Queue status labels matching the kiosk monitor display.
 * Lifecycle: submitted → [Proceed] → waiting_for_admin_approval (queue: now_serving)
 *          → [Link Document] → linked (queue: processing)
 *          → approved (queue: processing, document being prepared)
 *          → [Download PDF] → released (queue: done)
 */

const QUEUE_STATUS_MAP = {
  waiting: { label: 'Waiting in Queue', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  now_serving: { label: 'Now Serving', color: 'bg-blue-100 text-blue-700', icon: Play },
  processing: { label: 'Processing', color: 'bg-orange-100 text-orange-700', icon: Package },
  done: { label: 'Released', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: null },
};

const PORTAL_STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-yellow-100 text-yellow-700' },
  waiting_for_admin_approval: { label: 'Now Serving', color: 'bg-blue-100 text-blue-700' },
  linked: { label: 'Proceeding', color: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Approved', color: 'bg-purple-100 text-purple-700' },
  released: { label: 'Released', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

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
    } catch { toast.error('Failed to load requests'); }
  };

  useRealtimeRefresh(fetchAll);

  /**
   * Step 1 — Admin clicks "Proceed":
   * Sets portal status → waiting_for_admin_approval.
   * Kiosk queue ticket → now_serving (displayed on the kiosk monitor).
   */
  const handleProcess = async (id) => {
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.processPortalRequest(id)}`, {}, { withCredentials: true });
      toast.success('Resident called to counter — queue updated to Now Serving');
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to proceed');
    }
  };

  /**
   * Step 2 — Admin clicks "Link Document":
   * Creates a document_request linked to the portal_request.
   * Kiosk queue ticket → processing.
   */
  const handleLinkToDocument = async (id) => {
    try {
      await axios.put(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.linkPortalRequestToDocument(id)}`, {}, { withCredentials: true });
      toast.success('Document linked — queue updated to Proceeding');
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link document');
    }
  };

  return (
    <PageLayout testId="portal-requests-page">
      <PageHeader
        title="Online Requests"
        description="Manage kiosk and portal requests · Actions here update the kiosk queue monitor in real time"
      />

      {/* Workflow guide */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 flex-wrap">
        <span className="px-2 py-1 rounded bg-muted font-medium">1. Proceed</span>
        <span>→ Now Serving on kiosk</span>
        <span className="mx-1 text-border">|</span>
        <span className="px-2 py-1 rounded bg-muted font-medium">2. Link Document</span>
        <span>→ Proceeding on kiosk</span>
        <span className="mx-1 text-border">|</span>
        <span className="px-2 py-1 rounded bg-muted font-medium">3. Approve + Download PDF</span>
        <span>→ Released on kiosk</span>
      </div>

      {requests.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Globe} title="No online requests yet" description="Share your portal URL with residents" /></Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const statusCfg = PORTAL_STATUS_CONFIG[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-600' };
            const queueCfg = r.queue_code ? QUEUE_STATUS_MAP[r.queue_status] : null;
            const QueueIcon = queueCfg?.icon;

            return (
              <Card key={r.id} className="p-6" data-testid={`portal-request-card-${r.id}`}>
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-mono font-semibold text-primary">{r.tracking_number}</p>

                      {/* Portal request status */}
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>

                      {/* Queue status badge — shows what the kiosk monitor is displaying */}
                      {r.queue_code && (
                        <span className={`px-3 py-1 text-xs rounded-full font-medium flex items-center gap-1 ${queueCfg?.color || 'bg-gray-100 text-gray-600'}`}>
                          {QueueIcon && <QueueIcon size={11} />}
                          Queue {r.queue_code}
                          {queueCfg ? ` · ${queueCfg.label}` : ''}
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-semibold mt-2">{r.full_name}</h3>
                  </div>

                  {/* Action buttons — one at a time, matching the lifecycle step */}
                  <div className="flex flex-col gap-2 items-end">
                    {r.status === 'submitted' && (
                      <Button
                        size="sm"
                        onClick={() => handleProcess(r.id)}
                        data-testid={`process-${r.id}`}
                        className="bg-primary hover:bg-primary/90 hover:text-white gap-1"
                      >
                        <Play size={13} /> Proceed
                      </Button>
                    )}

                    {r.status === 'waiting_for_admin_approval' && (
                      <Button
                        size="sm"
                        onClick={() => handleLinkToDocument(r.id)}
                        data-testid={`link-${r.id}`}
                        variant="outline"
                        className="border-primary text-primary hover:bg-primary/10 gap-1"
                      >
                        <Link2 size={13} /> Link Document
                      </Button>
                    )}

                    {(r.status === 'linked' || r.status === 'approved') && (
                      <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                        <FileCheck size={13} />
                        {r.status === 'linked' ? 'Go to Documents to approve' : 'Go to Documents to download PDF'}
                      </span>
                    )}

                    {r.status === 'released' && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 size={13} /> Document released
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mt-3">
                  <p><span className="text-muted-foreground">Document:</span> {r.document_type?.replace(/_/g, ' ')}</p>
                  <p><span className="text-muted-foreground">Purpose:</span> {r.purpose}</p>
                  <p><span className="text-muted-foreground">Email:</span> {r.email}</p>
                  <p><span className="text-muted-foreground">Phone:</span> {r.contact_number}</p>
                  <p className="md:col-span-2"><span className="text-muted-foreground">Address:</span> {r.address}</p>
                  {r.source === 'kiosk_self_service' && (
                    <p className="md:col-span-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                        Kiosk Request · {r.kiosk_id}
                      </span>
                    </p>
                  )}
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
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};