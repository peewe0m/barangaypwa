import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from 'sonner';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResidentsPage } from './pages/ResidentsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import '@/App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/residents"
            element={
              <ProtectedRoute>
                <ResidentsPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/households"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Households"
                  description="Manage household records and family groupings"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/business"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Business Management"
                  description="Manage business clearances and permits"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/blotter"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Blotter Management"
                  description="Record and manage barangay incidents and complaints"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/health"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Health Records"
                  description="Manage health records and vaccination data"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/welfare"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Social Welfare"
                  description="Manage PWD, senior citizens, and solo parent records"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/barangay-id"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Barangay ID System"
                  description="Generate and manage barangay ID cards"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/appointments"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Appointments"
                  description="Manage appointment scheduling and queue system"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Payments & Collections"
                  description="Manage payments and official receipts"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Reports"
                  description="Generate and export various reports"
                />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <PlaceholderPage
                  title="Settings"
                  description="System configuration and user management"
                />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
