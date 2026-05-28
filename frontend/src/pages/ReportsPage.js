import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Download, BarChart3, Users, DollarSign } from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#2d6a4f', '#52b788', '#95d5b2', '#d8f3dc'];

export const ReportsPage = () => {
  const [residentReport, setResidentReport] = useState(null);
  const [financialReport, setFinancialReport] = useState(null);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      const [r, f] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residentReport}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.financialReport}`, { withCredentials: true }),
      ]);
      setResidentReport(r.data);
      setFinancialReport(f.data);
    } catch { toast.error('Failed to load reports'); }
  };

  useRealtimeRefresh(fetchReports);

  const exportResidentPDF = () => {
    if (!residentReport) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Resident Demographics Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Metric', 'Count']],
      body: [
        ['Total Residents', residentReport.total],
        ['Male', residentReport.male],
        ['Female', residentReport.female],
        ['Voters', residentReport.voters],
        ['PWD', residentReport.pwd],
        ['Senior Citizens', residentReport.senior],
        ['Solo Parents', residentReport.solo_parent],
        ['Age 0-17', residentReport.age_groups['0-17']],
        ['Age 18-35', residentReport.age_groups['18-35']],
        ['Age 36-59', residentReport.age_groups['36-59']],
        ['Age 60+', residentReport.age_groups['60+']],
      ],
      theme: 'striped',
      headStyles: { fillColor: [45, 106, 79] },
    });
    doc.save(`resident_report_${Date.now()}.pdf`);
    toast.success('PDF exported');
  };

  const exportFinancialPDF = () => {
    if (!financialReport) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Financial Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Metric', 'Value']],
      body: [
        ['Total Revenue', `PHP ${financialReport.total_revenue.toLocaleString()}`],
        ['Transactions', financialReport.transaction_count],
        ...Object.entries(financialReport.by_type || {}).map(([k, v]) => [k.replace('_', ' '), `PHP ${v.toLocaleString()}`]),
      ],
      theme: 'striped',
      headStyles: { fillColor: [45, 106, 79] },
    });
    doc.save(`financial_report_${Date.now()}.pdf`);
    toast.success('PDF exported');
  };

  const exportCSV = (data, filename) => {
    const rows = Object.entries(data).filter(([_, v]) => typeof v !== 'object').map(([k, v]) => `${k},${v}`);
    const csv = ['Field,Value', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const ageGroupData = residentReport ? Object.entries(residentReport.age_groups).map(([k, v]) => ({ name: k, value: v })) : [];
  const genderData = residentReport ? [
    { name: 'Male', value: residentReport.male },
    { name: 'Female', value: residentReport.female },
  ].filter((d) => d.value > 0) : [];

  return (
    <PageLayout testId="reports-page">
      <PageHeader title="Reports" description="Generate and export comprehensive reports" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resident Report */}
        <Card className="p-6" data-testid="resident-report-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="text-primary" size={20} />
              <h3 className="text-lg font-heading font-semibold">Resident Demographics</h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportResidentPDF} data-testid="export-resident-pdf">
                <Download size={14} className="mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportCSV(residentReport || {}, 'residents.csv')}>
                <Download size={14} className="mr-1" /> CSV
              </Button>
            </div>
          </div>
          {residentReport && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-heading font-bold text-primary">{residentReport.total}</p>
                </div>
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-xs text-muted-foreground">Voters</p>
                  <p className="text-2xl font-heading font-bold text-primary">{residentReport.voters}</p>
                </div>
              </div>
              {ageGroupData.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ageGroupData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2d6a4f" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </Card>

        {/* Financial Report */}
        <Card className="p-6" data-testid="financial-report-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="text-primary" size={20} />
              <h3 className="text-lg font-heading font-semibold">Financial Summary</h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportFinancialPDF} data-testid="export-financial-pdf">
                <Download size={14} className="mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportCSV(financialReport || {}, 'financial.csv')}>
                <Download size={14} className="mr-1" /> CSV
              </Button>
            </div>
          </div>
          {financialReport && (
            <>
              <div className="p-4 bg-primary text-white rounded-lg mb-4">
                <p className="text-xs text-white/80 uppercase">Total Revenue</p>
                <p className="text-3xl font-heading font-bold mt-1">₱{financialReport.total_revenue.toLocaleString()}</p>
                <p className="text-xs text-white/80 mt-1">{financialReport.transaction_count} transactions</p>
              </div>
              {Object.keys(financialReport.by_type || {}).length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(financialReport.by_type).map(([k, v]) => ({ name: k, value: v }))}
                      cx="50%" cy="50%" outerRadius={70} fill="#2d6a4f" dataKey="value"
                      label={(e) => `${e.name}: ₱${e.value}`}
                    >
                      {Object.keys(financialReport.by_type).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </Card>

        {/* Gender breakdown chart */}
        {genderData.length > 0 && (
          <Card className="p-6 lg:col-span-2">
            <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="text-primary" size={20} />
              Gender Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" outerRadius={90} fill="#2d6a4f" dataKey="value"
                     label={(e) => `${e.name}: ${e.value}`}>
                  {genderData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};
