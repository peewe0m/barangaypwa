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
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BarangayIDPage } from './pages/BarangayIDPage';
import { PortalPage } from './pages/PortalPage';
import { PortalRequestsPage } from './pages/PortalRequestsPage';
import '@/App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Public Portal */}
          <Route path="/portal" element={<PortalPage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected admin routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/residents" element={<ProtectedRoute><ResidentsPage /></ProtectedRoute>} />
          <Route path="/households" element={<ProtectedRoute><HouseholdsPage /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="/portal-requests" element={<ProtectedRoute><PortalRequestsPage /></ProtectedRoute>} />
          <Route path="/business" element={<ProtectedRoute><BusinessPage /></ProtectedRoute>} />
          <Route path="/blotter" element={<ProtectedRoute><BlotterPage /></ProtectedRoute>} />
          <Route path="/health" element={<ProtectedRoute><HealthPage /></ProtectedRoute>} />
          <Route path="/welfare" element={<ProtectedRoute><WelfarePage /></ProtectedRoute>} />
          <Route path="/barangay-id" element={<ProtectedRoute><BarangayIDPage /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
