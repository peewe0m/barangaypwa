import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from './ui/card';

export const StatCard = ({ title, value, icon: Icon, color = 'primary', trend }) => {
  return (
    <Card
      className="p-6 border border-border hover:-translate-y-1 hover:shadow-md transition-all duration-200"
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <h3 className="text-3xl font-heading font-bold mt-2" data-testid={`stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </h3>
          {trend && (
            <p className="text-xs text-muted-foreground mt-2">{trend}</p>
          )}
        </div>
        <div className={`p-4 rounded-lg bg-${color}/10`}>
          <Icon size={28} className={`text-${color}`} />
        </div>
      </div>
    </Card>
  );
};
