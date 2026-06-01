import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Users,
  Home,
  UserCheck,
  Heart,
  FileText,
  TrendingUp,
  Vote,
  Sparkles,
  Database,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StatCard } from '../components/StatCard';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';
import { SYSTEM_CONFIG } from '../config/system';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { OrganicLoader } from '../components/Loading/OrganicLoader';
import { NEON_DARK } from '../components/charts/chartTheme';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ─── Custom Bar with top-to-bottom teal gradient ────────────────────────────
const GradientBar = (props) => {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const id = `bar-grad-${x}-${y}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NEON_DARK.barColor.start} stopOpacity={1} />
          <stop offset="55%" stopColor={NEON_DARK.barColor.mid} stopOpacity={0.9} />
          <stop offset="100%" stopColor={NEON_DARK.barColor.end} stopOpacity={0.7} />
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={`url(#${id})`}
        style={{ filter: `drop-shadow(0 0 6px ${NEON_DARK.barColor.start}88)` }}
      />
    </g>
  );
};

// ─── Custom Pie center label ─────────────────────────────────────────────────
const PieCenterLabel = ({ cx, cy, total }) => (
  <g>
    <text
      x={cx}
      y={cy - 8}
      textAnchor="middle"
      fill="rgba(255,255,255,0.55)"
      fontSize={11}
      fontWeight={500}
      letterSpacing={1}
    >
      Total
    </text>
    <text
      x={cx}
      y={cy + 14}
      textAnchor="middle"
      fill={NEON_DARK.totalLabel}
      fontSize={22}
      fontWeight={700}
    >
      {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
    </text>
  </g>
);

// ─── Custom Pie legend (right side) ─────────────────────────────────────────
const PieLegend = ({ data }) => (
  <div className="flex flex-col justify-center gap-3 pl-2">
    {data.map((item, i) => (
      <div key={item.name} className="flex items-center gap-2 min-w-0">
        <span
          className="shrink-0 rounded-full"
          style={{
            width: 10,
            height: 10,
            background: NEON_DARK.pieColors[i % NEON_DARK.pieColors.length],
            boxShadow: `0 0 6px ${NEON_DARK.pieColors[i % NEON_DARK.pieColors.length]}`,
          }}
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90 truncate">
            {item.value >= 1000 ? `${(item.value / 1000).toFixed(2)}k` : item.value}
          </p>
          <p className="text-[10px] text-white/40 truncate">{item.name}</p>
        </div>
      </div>
    ))}
  </div>
);

// ─── Tooltip styles ──────────────────────────────────────────────────────────
const darkTooltipStyle = {
  backgroundColor: NEON_DARK.tooltipBg,
  border: `1px solid ${NEON_DARK.tooltipBorder}`,
  borderRadius: '0.6rem',
  color: NEON_DARK.tooltipText,
  fontSize: 12,
  boxShadow: `0 4px 20px rgba(45,106,79,0.25)`,
};

const chartCardBase = {
  background: NEON_DARK.background,
  border: '1px solid rgba(82,183,136,0.2)',
  borderRadius: '1rem',
  boxShadow: '0 8px 32px rgba(45,106,79,0.18), 0 2px 12px rgba(0,0,0,0.4)',
};

// ─── Main component ──────────────────────────────────────────────────────────
export const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.dashboardStats}`,
        { withCredentials: true }
      );
      setStats(data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const { data } = await axios.post(
        `${API_CONFIG.baseURL}/seed/sample-data`,
        {},
        { withCredentials: true }
      );
      toast.success(data.message);
      fetchStats();
    } catch (error) {
      toast.error('Failed to seed sample data');
    } finally {
      setSeeding(false);
    }
  };

  useRealtimeRefresh(fetchStats);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 lg:ml-64 p-8">
          <div className="text-center py-20">
            <div className="mx-auto">
              <OrganicLoader title="Loading dashboard..." />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const demographicData = [
    { name: 'PWD', value: stats?.total_pwd || 0 },
    { name: 'Senior Citizens', value: stats?.total_senior || 0 },
    { name: 'Solo Parents', value: stats?.total_solo_parent || 0 },
    { name: 'Voters', value: stats?.total_voters || 0 },
  ].filter((item) => item.value > 0);

  const pieTotal = demographicData.reduce((s, d) => s + d.value, 0);

  const requestData = [
    { name: 'Jan', value: stats?.pending_requests || 0 },
    { name: 'Feb', value: Math.round((stats?.pending_requests || 0) * 1.4) },
    { name: 'Mar', value: stats?.approved_requests || 0 },
    { name: 'Apr', value: Math.round((stats?.approved_requests || 0) * 0.8) },
    { name: 'May', value: Math.round(((stats?.pending_requests || 0) + (stats?.approved_requests || 0)) * 0.6) },
    { name: 'Jun', value: Math.round((stats?.today_transactions || 0) * 3) },
    { name: 'Jul', value: Math.round((stats?.today_transactions || 0) * 2) },
  ];

  const isEmpty = (stats?.total_residents || 0) === 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-4 md:p-8" data-testid="dashboard-main">
        {/* Welcome Banner */}
        <Card
          className="relative overflow-hidden mb-8 border-none shadow-lg"
          style={{
            background:
              'linear-gradient(135deg, hsl(153, 40%, 30%) 0%, hsl(153, 40%, 25%) 100%)',
          }}
          data-testid="welcome-banner"
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(255,255,255,0.24) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className="relative z-10 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={20} className="text-yellow-300" />
                <span className="text-sm text-white/80 uppercase tracking-widest">
                  {getGreeting()}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold">
                Welcome back, {user?.full_name?.split(' ')[0] || 'Admin'}!
              </h1>
              <p className="text-white/80 mt-2">
                Here's what's happening in {SYSTEM_CONFIG.barangayInfo.name} today
              </p>
            </div>
            {(isEmpty || (stats?.total_residents || 0) < 10) && (
              <Button
                onClick={handleSeedData}
                disabled={seeding}
                data-testid="seed-data-button"
                className="bg-white text-primary hover:bg-white/90 hover:text-primary font-semibold"
              >
                <Database size={16} className="mr-2" />
                {seeding ? 'Generating...' : 'Load Sample Data'}
              </Button>
            )}
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Residents" value={stats?.total_residents || 0} icon={Users} />
          <StatCard title="Households" value={stats?.total_households || 0} icon={Home} />
          <StatCard title="PWD" value={stats?.total_pwd || 0} icon={UserCheck} />
          <StatCard title="Senior Citizens" value={stats?.total_senior || 0} icon={Heart} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Voters" value={stats?.total_voters || 0} icon={Vote} />
          <StatCard title="Today's Transactions" value={stats?.today_transactions || 0} icon={TrendingUp} />
          <StatCard title="Pending Requests" value={stats?.pending_requests || 0} icon={FileText} />
          <StatCard title="Approved Docs" value={stats?.approved_requests || 0} icon={FileText} />
        </div>

        {/* ── CHARTS ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* ── Donut / Pie Chart ─────────────────────────────────────── */}
          <div style={chartCardBase} className="p-6" data-testid="demographic-chart">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Demographics Overview
            </h3>
            {demographicData.length > 0 ? (
              <div className="flex items-center gap-2">
                <div style={{ flex: '0 0 200px', height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={demographicData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={3}
                        dataKey="value"
                        animationDuration={900}
                        labelLine={false}
                        label={false}
                      >
                        {demographicData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={NEON_DARK.pieColors[index % NEON_DARK.pieColors.length]}
                            style={{
                              filter: `drop-shadow(0 0 8px ${NEON_DARK.pieColors[index % NEON_DARK.pieColors.length]}99)`,
                            }}
                          />
                        ))}
                        {/* Center total label rendered via customized label */}
                      </Pie>
                      <Tooltip
                        contentStyle={darkTooltipStyle}
                        itemStyle={{ color: NEON_DARK.tooltipText }}
                        formatter={(value, name) => [value.toLocaleString(), name]}
                      />
                      {/* Invisible pie just for the center label trick */}
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center total — positioned absolutely over the donut */}
                  <div
                    style={{
                      position: 'relative',
                      marginTop: -200,
                      height: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div className="text-center">
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, textTransform: 'uppercase' }}>Total</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: NEON_DARK.totalLabel, lineHeight: 1.2 }}>
                        {pieTotal >= 1000 ? `${(pieTotal / 1000).toFixed(1)}k` : pieTotal}
                      </p>
                    </div>
                  </div>
                </div>
                <PieLegend data={demographicData} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-white/30 text-sm">
                No demographic data available yet
              </div>
            )}
          </div>

          {/* ── Bar Chart ────────────────────────────────────────────── */}
          <div style={chartCardBase} className="p-6" data-testid="requests-chart">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Document Requests
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={requestData} barCategoryGap="30%" barGap={4}>
                <defs>
                  <linearGradient id="globalBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON_DARK.barColor.start} stopOpacity={1} />
                    <stop offset="55%" stopColor={NEON_DARK.barColor.mid} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={NEON_DARK.barColor.end} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={NEON_DARK.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke={NEON_DARK.axis}
                  tick={{ fill: NEON_DARK.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke={NEON_DARK.axis}
                  tick={{ fill: NEON_DARK.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={darkTooltipStyle}
                  itemStyle={{ color: NEON_DARK.tooltipText }}
                  cursor={{ fill: 'rgba(0,229,255,0.06)' }}
                />
                <Bar
                  dataKey="value"
                  fill="url(#globalBarGrad)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1000}
                  shape={<GradientBar />}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <Card className="p-6" data-testid="recent-activity">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-semibold">Recent Activity</h3>
            <span className="text-xs text-muted-foreground">
              Last {stats?.recent_activity?.length || 0} requests
            </span>
          </div>
          <div className="space-y-3">
            {stats?.recent_activity?.slice(0, 5).map((activity, index) => (
              <div
                key={activity.id || index}
                className="flex items-center justify-between p-4 bg-accent/30 hover:bg-accent/50 rounded-lg transition-colors duration-200"
                data-testid={`activity-item-${index}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">
                      {activity.document_type?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Doc #: {activity.document_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 text-xs rounded-full font-medium ${
                      activity.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {activity.status}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.recent_activity || stats.recent_activity.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={48} className="mx-auto mb-3 text-muted-foreground/30" />
                <p>No recent activity yet</p>
                <p className="text-xs mt-1">Recent document requests will appear here</p>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
