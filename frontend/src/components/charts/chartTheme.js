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
  background: 'hsl(var(--card))',
  border: `1px solid hsl(var(--border))`,
  borderRadius: '0.75rem',
  boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
  color: ORGANIC_GREEN.tooltipText,
};

export const tooltipStyle = {
  backgroundColor: ORGANIC_GREEN.tooltipBg,
  border: `1px solid ${ORGANIC_GREEN.tooltipBorder}`,
  borderRadius: '0.75rem',
  padding: '10px 12px',
};

export const makePieLabel = ({ formatter }) =>
  ({ name, value }) => {
    const v = typeof value === 'number' ? value : Number(value || 0);
    return formatter ? formatter(name, v) : `${name}: ${v}`;
  };

