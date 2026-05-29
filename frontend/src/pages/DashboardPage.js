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
import { ORGANIC_GREEN } from '../components/charts/chartTheme';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ORGANIC_GREEN.palette;


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

  const requestData = [
    { name: 'Pending', value: stats?.pending_requests || 0 },
    { name: 'Approved', value: stats?.approved_requests || 0 },
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
          <StatCard
            title="Total Residents"
            value={stats?.total_residents || 0}
            icon={Users}
          />
          <StatCard
            title="Households"
            value={stats?.total_households || 0}
            icon={Home}
          />
          <StatCard title="PWD" value={stats?.total_pwd || 0} icon={UserCheck} />
          <StatCard
            title="Senior Citizens"
            value={stats?.total_senior || 0}
            icon={Heart}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Voters"
            value={stats?.total_voters || 0}
            icon={Vote}
          />
          <StatCard
            title="Today's Transactions"
            value={stats?.today_transactions || 0}
            icon={TrendingUp}
          />
          <StatCard
            title="Pending Requests"
            value={stats?.pending_requests || 0}
            icon={FileText}
          />
          <StatCard
            title="Approved Docs"
            value={stats?.approved_requests || 0}
            icon={FileText}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 hover:shadow-md transition-shadow duration-300" data-testid="demographic-chart">
            <h3 className="text-lg font-heading font-semibold mb-4">
              Demographics Overview
            </h3>
            {demographicData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={demographicData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}`}
                    outerRadius={106}
                    dataKey="value"
                    animationDuration={900}
                  >

                    {demographicData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>No demographic data available yet</p>
              </div>
            )}
          </Card>

          <Card className="p-6 hover:shadow-md transition-shadow duration-300" data-testid="requests-chart">
            <h3 className="text-lg font-heading font-semibold mb-4">
              Document Requests
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={requestData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.8} />

                
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  radius={[8, 8, 0, 0]}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
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
                <FileText
                  size={48}
                  className="mx-auto mb-3 text-muted-foreground/30"
                />
                <p>No recent activity yet</p>
                <p className="text-xs mt-1">
                  Recent document requests will appear here
                </p>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
