import React from 'react';
import { Sidebar } from './Sidebar';

export const PageLayout = ({ children, testId }) => (
  <div className="flex min-h-screen bg-background">
    <Sidebar />
    <main className="flex-1 lg:ml-64 p-4 md:p-8" data-testid={testId}>
      {children}
    </main>
  </div>
);

export const PageHeader = ({ title, description, action }) => (
  <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div>
      <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary">{title}</h1>
      {description && <p className="text-muted-foreground mt-2">{description}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="text-center py-16">
    {Icon && <Icon size={48} className="mx-auto mb-3 text-muted-foreground/30" />}
    <p className="text-lg font-medium text-muted-foreground">{title}</p>
    {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
  </div>
);
