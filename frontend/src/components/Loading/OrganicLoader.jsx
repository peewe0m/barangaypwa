import React from 'react';

export const OrganicLoader = ({
  title = 'Loading...',
  subtitle = '',
  size = 56,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <div
        className="relative"
        style={{ width: size, height: size }}
        aria-label="loading"
        role="status"
      >
        {/* outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 180deg, rgba(45,106,79,0.95), rgba(82,183,136,0.9), rgba(45,106,79,0.95))',
          }}
        />
        {/* mask */}
        <div className="absolute inset-[3px] rounded-full bg-background" />

        {/* shimmer pulse */}
        <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-transparent" />

        {/* center dot */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: Math.max(10, size * 0.18), height: Math.max(10, size * 0.18), background: 'hsl(var(--primary))' }}
        />

        {/* spinner */}
        <div className="absolute inset-0 rounded-full animate-[spin_1.1s_linear_infinite]" style={{ border: '2px solid rgba(45,106,79,0.22)', borderTopColor: 'rgba(45,106,79,0.95)' }} />
      </div>

      <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
};

