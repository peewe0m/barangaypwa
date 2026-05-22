import React from 'react';
import { Card } from '../components/ui/card';
import { PageLayout, PageHeader } from '../components/PageLayout';
import { SYSTEM_CONFIG } from '../config/system';
import { useAuth } from '../context/AuthContext';
import { Building2, MapPin, Phone, Mail, User, Shield, Database, Palette } from 'lucide-react';

export const SettingsPage = () => {
  const { user } = useAuth();
  const bi = SYSTEM_CONFIG.barangayInfo;

  return (
    <PageLayout testId="settings-page">
      <PageHeader title="Settings" description="System configuration and information" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6" data-testid="barangay-info-card">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">Barangay Information</h3>
          </div>
          <div className="space-y-3">
            <InfoRow icon={Building2} label="Name" value={bi.name} />
            <InfoRow icon={MapPin} label="Address" value={bi.address} />
            <InfoRow icon={MapPin} label="Municipality" value={`${bi.municipality}, ${bi.province}`} />
            <InfoRow icon={MapPin} label="Region" value={bi.region} />
            <InfoRow icon={Phone} label="Contact" value={bi.contactNumber} />
            <InfoRow icon={Mail} label="Email" value={bi.email} />
          </div>
        </Card>

        <Card className="p-6" data-testid="officials-card">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">Barangay Officials</h3>
          </div>
          <div className="space-y-3">
            <InfoRow icon={User} label="Barangay Captain" value={bi.captainName} />
            <InfoRow icon={User} label="Secretary" value={bi.secretaryName} />
            <InfoRow icon={User} label="Treasurer" value={bi.treasurerName} />
          </div>
        </Card>

        <Card className="p-6" data-testid="user-account-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">Your Account</h3>
          </div>
          <div className="space-y-3">
            <InfoRow icon={User} label="Full Name" value={user?.full_name} />
            <InfoRow icon={Mail} label="Email" value={user?.email} />
            <InfoRow icon={Shield} label="Role" value={user?.role?.replace('_', ' ')} />
          </div>
        </Card>

        <Card className="p-6" data-testid="system-info-card">
          <div className="flex items-center gap-2 mb-4">
            <Database className="text-primary" size={20} />
            <h3 className="text-lg font-heading font-semibold">System Info</h3>
          </div>
          <div className="space-y-3">
            <InfoRow icon={Database} label="System" value={SYSTEM_CONFIG.systemName} />
            <InfoRow icon={Database} label="Version" value={SYSTEM_CONFIG.version} />
            <InfoRow icon={Palette} label="Theme" value="Organic & Earthy (Green)" />
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2" data-testid="document-fees-card">
          <h3 className="text-lg font-heading font-semibold mb-4">Document Fees</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(SYSTEM_CONFIG.documentFees).map(([key, value]) => (
              <div key={key} className="p-3 bg-accent rounded-lg">
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-lg font-heading font-bold text-primary mt-1">₱{value.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Fees are configured in <code className="px-2 py-0.5 bg-accent rounded">config/system.js</code> and{' '}
            <code className="px-2 py-0.5 bg-accent rounded">backend/config/system.py</code>
          </p>
        </Card>
      </div>
    </PageLayout>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
    <Icon size={16} className="text-muted-foreground mt-1" />
    <div className="flex-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  </div>
);
