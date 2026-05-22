import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Home, UserCheck, Heart, FileText, TrendingUp } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StatCard } from '../components/StatCard';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import API_CONFIG from '../config/api';
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

const COLORS = ['#2d6a4f', '#52b788', '#95d5b2', '#d8f3dc'];

export const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 lg:ml-64 p-8">
          <div className="text-center py-20">Loading...</div>
        </div>
      </div>
    );
  }

  const demographicData = [
    { name: 'PWD', value: stats?.total_pwd || 0 },
    { name: 'Senior Citizens', value: stats?.total_senior || 0 },
    { name: 'Solo Parents', value: stats?.total_solo_parent || 0 },
    { name: 'Voters', value: stats?.total_voters || 0 },
  ];

  const requestData = [
    { name: 'Pending', value: stats?.pending_requests || 0 },
    { name: 'Approved', value: stats?.approved_requests || 0 },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 md:p-8" data-testid="dashboard-main">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome to the Barangay Management System</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Residents"
            value={stats?.total_residents || 0}
            icon={Users}
            color="primary"
          />
          <StatCard
            title="Total Households"
            value={stats?.total_households || 0}
            icon={Home}
            color="primary"
          />
          <StatCard
            title="PWD"
            value={stats?.total_pwd || 0}
            icon={UserCheck}
            color="primary"
          />
          <StatCard
            title="Senior Citizens"
            value={stats?.total_senior || 0}
            icon={Heart}
            color="primary"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Today's Transactions"
            value={stats?.today_transactions || 0}
            icon={TrendingUp}
            color="primary"
          />
          <StatCard
            title="Pending Requests"
            value={stats?.pending_requests || 0}
            icon={FileText}
            color="primary"
          />
          <StatCard
            title="Approved Documents"
            value={stats?.approved_requests || 0}
            icon={FileText}
            color="primary"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6" data-testid="demographic-chart">
            <h3 className="text-lg font-heading font-semibold mb-4">Demographics Overview</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={demographicData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {demographicData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6" data-testid="requests-chart">
            <h3 className="text-lg font-heading font-semibold mb-4">Document Requests</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={requestData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#2d6a4f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="p-6" data-testid="recent-activity">
          <h3 className="text-lg font-heading font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {stats?.recent_activity?.slice(0, 5).map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-accent/50 rounded-lg"
                data-testid={`activity-item-${index}`}
              >
                <div>
                  <p className="font-medium">{activity.document_type?.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-muted-foreground">Status: {activity.status}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(activity.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
            {(!stats?.recent_activity || stats.recent_activity.length === 0) && (
              <p className="text-center text-muted-foreground py-8">No recent activity</p>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
