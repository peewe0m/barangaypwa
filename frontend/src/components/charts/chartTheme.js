// Dark neon chart theme matching the dashboard's visual style
export const NEON_DARK = {
  // Neon gradient palette for bar charts (teal/cyan gradient feel)
  barColor: {
    start: '#00e5ff',
    mid: '#00bcd4',
    end: '#006064',
  },
  // Pie chart palette — distinct neon segments on dark background
  pieColors: ['#00e5ff', '#7c4dff', '#ea80fc', '#ff6d00', '#69f0ae'],
  axis: 'rgba(255,255,255,0.45)',
  grid: 'rgba(255,255,255,0.06)',
  tooltipBg: 'rgba(10, 14, 40, 0.95)',
  tooltipBorder: 'rgba(0, 229, 255, 0.3)',
  tooltipText: '#e0f7fa',
  background: 'linear-gradient(160deg, #0a0e28 0%, #0d1b2a 100%)',
  cardBg: 'rgba(13, 27, 42, 0.95)',
  totalLabel: '#00e5ff',
};

// Legacy organic green kept for backward compatibility
export const ORGANIC_GREEN = {
  palette: ['#2d6a4f', '#52b788', '#95d5b2', '#d8f3dc'],
  axis: 'hsl(var(--muted-foreground))',
  grid: 'rgba(45, 106, 79, 0.18)',
  tooltipBg: 'hsl(var(--card))',
  tooltipBorder: 'hsl(var(--border))',
  tooltipText: 'hsl(var(--foreground))',
  primary: 'hsl(var(--primary))',
};

export const chartCardStyle = {
  background: NEON_DARK.cardBg,
  border: `1px solid rgba(0,229,255,0.15)`,
  borderRadius: '1rem',
  boxShadow: '0 8px 32px rgba(0,229,255,0.06), 0 2px 12px rgba(0,0,0,0.4)',
  color: NEON_DARK.tooltipText,
};

export const tooltipStyle = {
  backgroundColor: NEON_DARK.tooltipBg,
  border: `1px solid ${NEON_DARK.tooltipBorder}`,
  borderRadius: '0.75rem',
  padding: '10px 14px',
  color: NEON_DARK.tooltipText,
  boxShadow: '0 4px 20px rgba(0,229,255,0.15)',
};

export const makePieLabel = ({ formatter }) =>
  ({ name, value }) => {
    const v = typeof value === 'number' ? value : Number(value || 0);
    return formatter ? formatter(name, v) : `${name}: ${v}`;
  };
