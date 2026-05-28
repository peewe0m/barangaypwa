import React, { useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Search, Download, CheckCircle2, Clock } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useNavigate } from 'react-router-dom';

export const PortalTrackingPage = () => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleTrack = async (e) => {
    e.preventDefault();
    const tn = trackingNumber.trim();
    if (!tn) return;

    setLoading(true);
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.trackRequest(tn)}`, {
        withCredentials: false,
      });
      setTrackResult(data);
    } catch {
      toast.error('Request not found');
      setTrackResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!trackResult?.tracking_number) return;
    const tn = trackResult.tracking_number;
    try {
      const response = await axios.get(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.trackDownload(tn)}`,
        {
          withCredentials: false,
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      const filenameBase = trackResult.document_type_label || 'document';
      const filenameDocNum = trackResult.document_number || tn;
      a.href = url;
      a.download = `${filenameBase}_${filenameDocNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Document downloaded');
    } catch {
      toast.error('Failed to download document');
    }
  };

  const status = trackResult?.tracking_status || trackResult?.status;
  const documentApproved = trackResult?.document_status === 'approved';

  return (
    <PageLayout testId="portal-tracking-page">
      <PageHeader title="Track Online Request" description="Enter your tracking number and download when approved." />

      <div className="max-w-2xl mx-auto">
        <Card className="p-6 md:p-8" data-testid="portal-tracking-card">
          <form onSubmit={handleTrack} className="flex gap-2 flex-wrap items-center">
            <Input
              data-testid="portal-tracking-input"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. PT-20260522123456"
              className="flex-1 min-w-[220px]"
            />
            <Button type="submit" disabled={loading} data-testid="portal-track-button" className="bg-primary hover:bg-primary/90 hover:text-white">
              <Search size={16} className="mr-2" />
              {loading ? 'Tracking...' : 'Track'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/portal')}>
              Back
            </Button>
          </form>

          {!trackResult ? (
            <div className="mt-8">
              <EmptyState
                icon={Search}
                title="Enter a tracking number"
                description="Your request status will appear here."
              />
            </div>
          ) : (
            <div className="mt-6 p-5 bg-accent rounded-lg" data-testid="portal-track-result">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="font-mono font-semibold text-primary">{trackResult.tracking_number}</p>
                <span
                  className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${
                    status === 'approved' || trackResult.document_status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {(status === 'approved' || trackResult.document_status === 'approved') ? (
                    <CheckCircle2 size={12} className="inline mr-1" />
                  ) : (
                    <Clock size={12} className="inline mr-1" />
                  )}
                  {status || 'submitted'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Name:</span> {trackResult.full_name}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span> {trackResult.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> {trackResult.contact_number}
                </p>
                <p>
                  <span className="text-muted-foreground">Document:</span>{' '}
                  {trackResult.document_type_label || trackResult.document_type?.replace(/_/g, ' ')}
                </p>
                <p className="md:col-span-2">
                  <span className="text-muted-foreground">Purpose:</span> {trackResult.purpose}
                </p>
                <p className="md:col-span-2 text-xs text-muted-foreground">
                  Submitted: {trackResult.created_at ? new Date(trackResult.created_at).toLocaleString() : ''}
                </p>
              </div>

              <div className="mt-5 flex gap-2 flex-wrap">
                <Button
                  type="button"
                  disabled={!documentApproved}
                  onClick={handleDownload}
                  className={documentApproved ? 'bg-primary hover:bg-primary/90 hover:text-white' : 'opacity-50 cursor-not-allowed'}
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
              </div>

              {!documentApproved && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Your document will be available once the barangay approves your request.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
};

