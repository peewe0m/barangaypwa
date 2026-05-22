import React, { useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Search, CheckCircle2, Clock, Building2 } from 'lucide-react';
import API_CONFIG from '../config/api';
import { SYSTEM_CONFIG } from '../config/system';

export const PortalPage = () => {
  const [form, setForm] = useState({
    full_name: '', email: '', contact_number: '', address: '',
    document_type: 'barangay_clearance', purpose: '',
  });
  const [submitted, setSubmitted] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackResult, setTrackResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.portalRequest}`, form);
      setSubmitted(data);
      toast.success('Request submitted!');
    } catch { toast.error('Failed to submit request'); }
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    try {
      const { data } = await axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.trackRequest(trackingNumber.trim())}`);
      setTrackResult(data);
    } catch {
      toast.error('Request not found');
      setTrackResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden text-white">
        <div className="absolute inset-0"
             style={{
               background: 'linear-gradient(135deg, hsl(153, 40%, 30%) 0%, hsl(153, 40%, 25%) 100%)',
             }} />
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/c00e8b19-67ce-4ebd-a112-6d19f4b88df7/images/4a5456444474b057bd66bcd466c336e25090d0fdd7d5615cddd064b9385c00a8.png)',
            backgroundSize: 'cover',
          }}
        />
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-12 md:py-20">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={20} className="text-yellow-300" />
            <span className="text-sm uppercase tracking-widest text-white/80">Online Portal</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading font-bold">
            {SYSTEM_CONFIG.barangayInfo.name}
          </h1>
          <p className="text-base md:text-xl text-white/80 mt-3 max-w-2xl">
            Request your barangay documents online — fast, secure, and convenient.
            Submit a request, get a tracking number, and pick up when ready.
          </p>
          <div className="flex gap-3 mt-6">
            <a href="/login" className="px-5 py-2 bg-white text-primary rounded-md font-medium hover:bg-white/90 transition">
              Staff Login
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <Tabs defaultValue="request">
          <TabsList className="mb-6 grid grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="request" data-testid="portal-tab-request">
              <FileText size={16} className="mr-2" /> Request Document
            </TabsTrigger>
            <TabsTrigger value="track" data-testid="portal-tab-track">
              <Search size={16} className="mr-2" /> Track Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="request">
            {submitted ? (
              <Card className="p-8 text-center" data-testid="portal-success">
                <CheckCircle2 size={64} className="mx-auto text-primary mb-4" />
                <h2 className="text-2xl font-heading font-bold text-primary">Request Submitted!</h2>
                <p className="text-muted-foreground mt-2">Save your tracking number to check status:</p>
                <div className="my-6 p-4 bg-accent rounded-lg inline-block">
                  <p className="text-xs text-muted-foreground uppercase">Tracking Number</p>
                  <p className="text-2xl font-mono font-bold text-primary mt-1" data-testid="portal-tracking-number">
                    {submitted.tracking_number}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Visit the barangay hall to claim your document. Bring a valid ID.
                </p>
                <Button onClick={() => { setSubmitted(null); setForm({ ...form, full_name: '', email: '', contact_number: '', address: '', purpose: '' }); }} className="mt-6">
                  Submit Another Request
                </Button>
              </Card>
            ) : (
              <Card className="p-6 md:p-8" data-testid="portal-request-form">
                <h2 className="text-2xl font-heading font-bold mb-2">Submit Document Request</h2>
                <p className="text-muted-foreground mb-6">Fill out the form below and we'll process your request.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label>Full Name *</Label>
                      <Input data-testid="portal-fullname-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input type="email" data-testid="portal-email-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Contact Number *</Label>
                      <Input data-testid="portal-contact-input" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} required />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Address *</Label>
                      <Input data-testid="portal-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Document Type *</Label>
                      <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                        <SelectTrigger data-testid="portal-doctype-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SYSTEM_CONFIG.documentTypes.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label} (₱{SYSTEM_CONFIG.documentFees[d.value] || 0})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Purpose *</Label>
                      <Input data-testid="portal-purpose-input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required placeholder="e.g. Employment, School..." />
                    </div>
                  </div>
                  <Button type="submit" data-testid="portal-submit-button" className="w-full bg-primary hover:bg-primary/90 hover:text-white">
                    Submit Request
                  </Button>
                </form>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="track">
            <Card className="p-6 md:p-8" data-testid="portal-track-card">
              <h2 className="text-2xl font-heading font-bold mb-2">Track Your Request</h2>
              <p className="text-muted-foreground mb-6">Enter the tracking number you received.</p>
              <form onSubmit={handleTrack} className="flex gap-2">
                <Input data-testid="portal-tracking-input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. PT-20260522123456" />
                <Button type="submit" data-testid="portal-track-button" className="bg-primary hover:bg-primary/90 hover:text-white">
                  <Search size={16} className="mr-2" /> Track
                </Button>
              </form>
              {trackResult && (
                <div className="mt-6 p-5 bg-accent rounded-lg" data-testid="portal-track-result">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono font-semibold text-primary">{trackResult.tracking_number}</p>
                    <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${
                      trackResult.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {trackResult.status === 'processed' ? <CheckCircle2 size={12} className="inline mr-1" /> : <Clock size={12} className="inline mr-1" />}
                      {trackResult.status}
                    </span>
                  </div>
                  <p><span className="text-muted-foreground text-sm">Name:</span> {trackResult.full_name}</p>
                  <p><span className="text-muted-foreground text-sm">Document:</span> {trackResult.document_type?.replace(/_/g, ' ')}</p>
                  <p><span className="text-muted-foreground text-sm">Purpose:</span> {trackResult.purpose}</p>
                  <p><span className="text-muted-foreground text-sm">Submitted:</span> {new Date(trackResult.created_at).toLocaleString()}</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          <Card className="p-5">
            <div className="p-3 bg-accent rounded-lg inline-block mb-3"><FileText className="text-primary" size={20} /></div>
            <h3 className="font-heading font-semibold">8 Document Types</h3>
            <p className="text-sm text-muted-foreground mt-1">From clearances to certificates</p>
          </Card>
          <Card className="p-5">
            <div className="p-3 bg-accent rounded-lg inline-block mb-3"><Clock className="text-primary" size={20} /></div>
            <h3 className="font-heading font-semibold">Fast Processing</h3>
            <p className="text-sm text-muted-foreground mt-1">Usually ready within 1-2 days</p>
          </Card>
          <Card className="p-5">
            <div className="p-3 bg-accent rounded-lg inline-block mb-3"><CheckCircle2 className="text-primary" size={20} /></div>
            <h3 className="font-heading font-semibold">Track Anytime</h3>
            <p className="text-sm text-muted-foreground mt-1">Real-time status updates</p>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-6 mt-12 text-center text-sm text-muted-foreground">
        <p>{SYSTEM_CONFIG.barangayInfo.name} • {SYSTEM_CONFIG.barangayInfo.municipality}, {SYSTEM_CONFIG.barangayInfo.province}</p>
        <p className="mt-1">{SYSTEM_CONFIG.barangayInfo.contactNumber} • {SYSTEM_CONFIG.barangayInfo.email}</p>
      </footer>
    </div>
  );
};
