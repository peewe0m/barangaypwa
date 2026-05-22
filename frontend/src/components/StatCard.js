import React from 'react';
import { Card } from './ui/card';
import { AnimatedNumber } from './AnimatedNumber';

export const StatCard = ({ title, value, icon: Icon, color = 'primary', trend, accentColor }) => {
  const testId = title.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
  return (
    <Card
      className="group p-6 border border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer relative overflow-hidden"
      data-testid={`stat-card-${testId}`}
    >
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 group-hover:opacity-10 transition-opacity duration-300 -mr-10 -mt-10"
        style={{ background: accentColor || 'hsl(var(--primary))' }}
      />
      <div className="flex items-center justify-between relative z-10">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
          <h3
            className="text-4xl font-heading font-bold mt-2 text-primary"
            data-testid={`stat-value-${testId}`}
          >
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </h3>
          {trend && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              {trend}
            </p>
          )}
        </div>
        <div
          className="p-4 rounded-xl group-hover:scale-110 transition-transform duration-300"
          style={{ background: 'hsl(var(--accent))' }}
        >
          <Icon size={28} className="text-primary" />
        </div>
      </div>
    </Card>
  );
};
