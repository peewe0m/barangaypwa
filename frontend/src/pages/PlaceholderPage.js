import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { Card } from '../components/ui/card';

export const PlaceholderPage = ({ title, description }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold text-primary">{title}</h1>
          <p className="text-muted-foreground mt-2">{description}</p>
        </div>

        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-2xl font-heading font-semibold mb-2">Under Development</h2>
            <p className="text-muted-foreground">
              This module is currently under development. Check back soon for updates!
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
};
