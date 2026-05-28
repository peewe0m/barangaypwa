import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasModuleAccess, isAdminRole } from '../config/modules';
import { Card } from './ui/card';
import { ShieldAlert } from 'lucide-react';

export const ProtectedRoute = ({ children, moduleKey, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if ((adminOnly && !isAdminRole(user.role)) || !hasModuleAccess(user, moduleKey)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto text-primary" size={42} />
          <h1 className="mt-4 text-xl font-heading font-semibold text-primary">Access Restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have permission to open this module. Contact an administrator if your access needs to be updated.
          </p>
        </Card>
      </div>
    );
  }

  return children;
};
