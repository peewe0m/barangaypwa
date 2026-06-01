// Dark neon chart theme — graph colors stay neon, backgrounds blend with organic green
export const NEON_DARK = {
  barColor: {
    start: '#00e5ff',
    mid: '#00bcd4',
    end: '#006064',
  },
  pieColors: ['#00e5ff', '#7c4dff', '#ea80fc', '#ff6d00', '#69f0ae'],
  axis: 'rgba(255,255,255,0.45)',
  grid: 'rgba(255,255,255,0.06)',
  tooltipBg: 'rgba(18, 42, 30, 0.97)',
  tooltipBorder: 'rgba(82, 183, 136, 0.4)',
  tooltipText: '#d8f3dc',
  // Card background blends dark green → deep forest (organic green family)
  background: 'linear-gradient(160deg, #0d2218 0%, #112b1e 60%, #0a1f16 100%)',
  cardBg: 'rgba(13, 34, 24, 0.97)',
  totalLabel: '#52b788',
};

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
  background: NEON_DARK.background,
  border: `1px solid rgba(82, 183, 136, 0.2)`,
  borderRadius: '1rem',
  boxShadow: '0 8px 32px rgba(45,106,79,0.18), 0 2px 12px rgba(0,0,0,0.4)',
  color: NEON_DARK.tooltipText,
};

export const tooltipStyle = {
  backgroundColor: NEON_DARK.tooltipBg,
  border: `1px solid ${NEON_DARK.tooltipBorder}`,
  borderRadius: '0.75rem',
  padding: '10px 14px',
  color: NEON_DARK.tooltipText,
  boxShadow: '0 4px 20px rgba(45,106,79,0.25)',
};

export const makePieLabel = ({ formatter }) =>
  ({ name, value }) => {
    const v = typeof value === 'number' ? value : Number(value || 0);
    return formatter ? formatter(name, v) : `${name}: ${v}`;
  };
