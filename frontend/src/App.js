import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from 'sonner';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResidentsPage } from './pages/ResidentsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { HouseholdsPage } from './pages/HouseholdsPage';
import { BlotterPage } from './pages/BlotterPage';
import { BusinessPage } from './pages/BusinessPage';
import { HealthPage } from './pages/HealthPage';
import { WelfarePage } from './pages/WelfarePage';
import { MedicineInventoryPage } from './pages/MedicineInventoryPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BarangayIDPage } from './pages/BarangayIDPage';
import { PortalPage } from './pages/PortalPage';
import { PortalRequestsPage } from './pages/PortalRequestsPage';
import { PortalTrackingPage } from './pages/PortalTrackingPage';
import '@/App.css';

function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Public Portal */}
          <Route path="/portal" element={<PortalPage />} />
          <Route path="/portal/track" element={<PortalTrackingPage />} />

          {/* Auth */}

          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected admin routes */}
          <Route path="/dashboard" element={<ProtectedRoute moduleKey="dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="/residents" element={<ProtectedRoute moduleKey="residents"><ResidentsPage /></ProtectedRoute>} />
          <Route path="/households" element={<ProtectedRoute moduleKey="households"><HouseholdsPage /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute moduleKey="documents"><DocumentsPage /></ProtectedRoute>} />
          <Route path="/portal-requests" element={<ProtectedRoute moduleKey="portal_requests"><PortalRequestsPage /></ProtectedRoute>} />
          <Route path="/business" element={<ProtectedRoute moduleKey="business"><BusinessPage /></ProtectedRoute>} />
          <Route path="/blotter" element={<ProtectedRoute moduleKey="blotter"><BlotterPage /></ProtectedRoute>} />
          <Route path="/health" element={<ProtectedRoute moduleKey="health"><HealthPage /></ProtectedRoute>} />
          <Route path="/medicine-inventory" element={<ProtectedRoute moduleKey="medicine_inventory"><MedicineInventoryPage /></ProtectedRoute>} />
          <Route path="/welfare" element={<ProtectedRoute moduleKey="welfare"><WelfarePage /></ProtectedRoute>} />
          <Route path="/barangay-id" element={<ProtectedRoute moduleKey="barangay_id"><BarangayIDPage /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute moduleKey="appointments"><AppointmentsPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute moduleKey="payments"><PaymentsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute moduleKey="reports"><ReportsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
