<<<<<<< HEAD
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Download, BarChart3, Users, DollarSign } from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
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
  Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { ORGANIC_GREEN } from '../components/charts/chartTheme';

const COLORS = ORGANIC_GREEN.palette;

export const ReportsPage = () => {
  const [residentReport, setResidentReport] = useState(null);
  const [financialReport, setFinancialReport] = useState(null);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReports = async () => {
    try {
      const [r, f] = await Promise.all([
        axios.get(
          `${API_CONFIG.baseURL}${API_CONFIG.endpoints.residentReport}`,
          { withCredentials: true }
        ),
        axios.get(
          `${API_CONFIG.baseURL}${API_CONFIG.endpoints.financialReport}`,
          { withCredentials: true }
        ),
      ]);
      setResidentReport(r.data);
      setFinancialReport(f.data);
    } catch {
      toast.error('Failed to load reports');
    }
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
        ...Object.entries(financialReport.by_type || {}).map(([k, v]) => [
          k.replace('_', ' '),
          `PHP ${v.toLocaleString()}`,
        ]),
      ],
      theme: 'striped',
      headStyles: { fillColor: [45, 106, 79] },
    });
    doc.save(`financial_report_${Date.now()}.pdf`);
    toast.success('PDF exported');
  };

  const exportCSV = (data, filename) => {
    const rows = Object.entries(data)
      .filter(([_, v]) => typeof v !== 'object')
      .map(([k, v]) => `${k},${v}`);
    const csv = ['Field,Value', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const ageGroupData = residentReport
    ? Object.entries(residentReport.age_groups).map(([k, v]) => ({
        name: k,
        value: v,
      }))
    : [];

  const genderData = residentReport
    ? [
        { name: 'Male', value: residentReport.male },
        { name: 'Female', value: residentReport.female },
      ].filter((d) => d.value > 0)
    : [];

  const chartTooltipProps = {
    contentStyle: {
      background: ORGANIC_GREEN.tooltipBg,
      border: `1px solid ${ORGANIC_GREEN.tooltipBorder}`,
      borderRadius: '0.75rem',
      padding: '10px 12px',
      color: ORGANIC_GREEN.tooltipText,
    },
    itemStyle: { color: ORGANIC_GREEN.primary },
  };

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
              <Button
                size="sm"
                variant="outline"
                onClick={exportResidentPDF}
                data-testid="export-resident-pdf"
              >
                <Download size={14} className="mr-1" /> PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportCSV(residentReport || {}, 'residents.csv')}
              >
                <Download size={14} className="mr-1" /> CSV
              </Button>
            </div>
          </div>

          {residentReport && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-heading font-bold text-primary">
                    {residentReport.total}
                  </p>
                </div>
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-xs text-muted-foreground">Voters</p>
                  <p className="text-2xl font-heading font-bold text-primary">
                    {residentReport.voters}
                  </p>
                </div>
              </div>

              {ageGroupData.length > 0 && (
                <div className="chart-enter">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ageGroupData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={ORGANIC_GREEN.grid}
                        opacity={0.9}
                      />
                      <XAxis dataKey="name" stroke={ORGANIC_GREEN.axis} tick={{ fill: ORGANIC_GREEN.axis }} />
                      <YAxis stroke={ORGANIC_GREEN.axis} tick={{ fill: ORGANIC_GREEN.axis }} />
                      <Tooltip {...chartTooltipProps} />
                      <Bar
                        dataKey="value"
                        fill={ORGANIC_GREEN.primary}
                        radius={[10, 10, 0, 0]}
                        animationDuration={900}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
              <Button
                size="sm"
                variant="outline"
                onClick={exportFinancialPDF}
                data-testid="export-financial-pdf"
              >
                <Download size={14} className="mr-1" /> PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportCSV(financialReport || {}, 'financial.csv')}
              >
                <Download size={14} className="mr-1" /> CSV
              </Button>
            </div>
          </div>

          {financialReport && (
            <>
              <div className="p-4 bg-primary text-white rounded-lg mb-4">
                <p className="text-xs text-white/80 uppercase">Total Revenue</p>
                <p className="text-3xl font-heading font-bold mt-1">
                  ₱{financialReport.total_revenue.toLocaleString()}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  {financialReport.transaction_count} transactions
                </p>
              </div>

              {Object.keys(financialReport.by_type || {}).length > 0 && (
                <div className="chart-enter">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={Object.entries(financialReport.by_type).map(([k, v]) => ({
                          name: k,
                          value: v,
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={(e) => `${e.name}`}
                      >
                        {Object.keys(financialReport.by_type).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...chartTooltipProps} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
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

            <div className="chart-enter">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={(e) => `${e.name}`}
                  >
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipProps} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

=======
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { toast } from 'sonner';
import {
  AlertCircle,
  Briefcase,
  Calendar as CalendarIcon,
  Download,
  FileText,
  HeartHandshake,
  Home,
  Loader2,
  Package,
  Users,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PageLayout, PageHeader } from '../components/PageLayout';
import API_CONFIG from '../config/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

const REPORT_TYPES = [
  { value: 'residents', label: 'Residents', icon: Users },
  { value: 'households', label: 'Households', icon: Home },
  { value: 'documents', label: 'Documents Released', icon: FileText },
  { value: 'businesses', label: 'Businesses', icon: Briefcase },
  { value: 'blotters', label: 'Blotters', icon: AlertCircle },
  { value: 'medicines', label: 'Medicine Inventory', icon: Package },
  { value: 'welfare', label: 'Social Welfare', icon: HeartHandshake },
];

const DATE_FIELD = {
  documents: ['downloaded_at', 'released_at', 'claimed_at', 'created_at'],
  businesses: ['created_at', 'registration_date', 'issue_date'],
  blotters: ['incident_date', 'created_at'],
  welfare: ['date', 'created_at'],
};

const asArray = (data, keys) => keys.map((key) => data?.[key]).find(Array.isArray) || [];
const nice = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const money = (value) => `PHP ${Number(value || 0).toLocaleString()}`;
const dateText = (value) => (value ? format(new Date(value), 'MMM d, yyyy') : 'N/A');
const truthyCount = (records, field) => records.filter((record) => Boolean(record[field])).length;

const resolveDate = (record, fields) => {
  const raw = fields.map((field) => record[field]).find(Boolean);
  if (!raw) return null;
  const parsed = raw instanceof Date ? raw : parseISO(String(raw));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const filterByRange = (records, fields, range) => {
  if (!fields || !range?.from || !range?.to) return records;
  return records.filter((record) => {
    const date = resolveDate(record, fields);
    return date ? isWithinInterval(date, { start: range.from, end: range.to }) : false;
  });
};

const createRange = (mode, selectedDate, customFrom, customTo) => {
  const anchor = selectedDate || new Date();
  if (mode === 'daily') return { from: startOfDay(anchor), to: endOfDay(anchor), label: format(anchor, 'MMMM d, yyyy') };
  if (mode === 'weekly') return { from: startOfWeek(anchor), to: endOfWeek(anchor), label: `${format(startOfWeek(anchor), 'MMM d')} - ${format(endOfWeek(anchor), 'MMM d, yyyy')}` };
  if (mode === 'monthly') return { from: startOfMonth(anchor), to: endOfMonth(anchor), label: format(anchor, 'MMMM yyyy') };

  const from = startOfDay(customFrom ? new Date(customFrom) : anchor);
  const to = endOfDay(customTo ? new Date(customTo) : anchor);
  return { from, to, label: `${dateText(from)} - ${dateText(to)}` };
};

const buildDoc = (title, rangeLabel) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Barangay Management System', 14, 16);
  doc.setFontSize(11);
  doc.text(title, 14, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Coverage: ${rangeLabel}`, 14, 31);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 36);
  return doc;
};

const addTable = (doc, title, head, body, startY) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, 14, startY);
  autoTable(doc, {
    startY: startY + 4,
    head: [head],
    body: body.length ? body : [['No records available', ...head.slice(1).map(() => '')]],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [45, 106, 79], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 248, 246] },
  });
  return doc.lastAutoTable.finalY + 10;
};

export const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('residents');
  const [period, setPeriod] = useState('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [data, setData] = useState({
    residents: [],
    households: [],
    documents: [],
    businesses: [],
    blotters: [],
    medicines: [],
    welfare: [],
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [residents, households, documents, businesses, blotters, medicines, welfare] = await Promise.all([
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.residents}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.households}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.documentRequests}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.businesses}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.blotters}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.medicineInventory}`, { withCredentials: true }),
        axios.get(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.welfareRecords}`, { withCredentials: true }),
      ]);

      setData({
        residents: asArray(residents.data, ['residents']),
        households: asArray(households.data, ['households']),
        documents: asArray(documents.data, ['requests', 'documents']),
        businesses: asArray(businesses.data, ['businesses']),
        blotters: asArray(blotters.data, ['blotters']),
        medicines: asArray(medicines.data, ['medicines', 'records']),
        welfare: asArray(welfare.data, ['records', 'welfare']),
      });
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useRealtimeRefresh(fetchReports);

  const range = useMemo(
    () => createRange(period, selectedDate, customFrom, customTo),
    [period, selectedDate, customFrom, customTo]
  );

  const releasedDocuments = useMemo(
    () => filterByRange(data.documents.filter((doc) => ['released', 'claimed'].includes(doc.status)), DATE_FIELD.documents, range),
    [data.documents, range]
  );

  const filtered = useMemo(() => ({
    residents: data.residents,
    households: data.households,
    documents: releasedDocuments,
    businesses: filterByRange(data.businesses, DATE_FIELD.businesses, range),
    blotters: filterByRange(data.blotters, DATE_FIELD.blotters, range),
    medicines: data.medicines,
    welfare: filterByRange(data.welfare, DATE_FIELD.welfare, range),
  }), [data, range, releasedDocuments]);

  const summaries = useMemo(() => {
    const lowStock = data.medicines.filter((m) => Number(m.quantity || 0) <= Number(m.reorder_threshold || 0) && Number(m.reorder_threshold || 0) > 0);
    return {
      residents: [
        ['Total Residents', data.residents.length],
        ['PWD', truthyCount(data.residents, 'is_pwd')],
        ['Senior Citizens', truthyCount(data.residents, 'is_senior')],
        ['Solo Parents', truthyCount(data.residents, 'is_solo_parent')],
        ['Registered Voters', truthyCount(data.residents, 'is_voter')],
      ],
      households: [['Total Households', data.households.length], ['Total Members', data.households.reduce((sum, h) => sum + Number(h.member_count || h.members?.length || 0), 0)]],
      documents: [['Released Documents', releasedDocuments.length], ['Claimed Documents', releasedDocuments.filter((d) => d.status === 'claimed').length]],
      businesses: [['Registered Businesses', filtered.businesses.length], ['Expired Permits', filtered.businesses.filter((b) => b.expiry_date && new Date(b.expiry_date) < new Date()).length]],
      blotters: [['Blotter Cases', filtered.blotters.length], ['Pending', filtered.blotters.filter((b) => b.status === 'pending').length], ['Resolved/Closed', filtered.blotters.filter((b) => ['resolved', 'closed'].includes(b.status)).length]],
      medicines: [['Inventory Items', data.medicines.length], ['Low Stock', lowStock.length], ['Total Quantity', data.medicines.reduce((sum, m) => sum + Number(m.quantity || 0), 0)]],
      welfare: [['Welfare Records', filtered.welfare.length], ['Total Assistance', money(filtered.welfare.reduce((sum, r) => sum + Number(r.amount || 0), 0))]],
    };
  }, [data, filtered, releasedDocuments]);

  const rows = {
    residents: filtered.residents.map((r) => [r.full_name, r.age || '', r.gender || '', [r.is_pwd && 'PWD', r.is_senior && 'Senior', r.is_solo_parent && 'Solo Parent', r.is_voter && 'Voter'].filter(Boolean).join(', ') || 'None', r.household_name || r.address || '']),
    households: filtered.households.map((h) => [h.household_record_number || h.id, h.household_head_name || 'N/A', h.household_type || 'N/A', h.member_count || h.members?.length || 0, h.address || 'N/A']),
    documents: filtered.documents.map((d) => [d.document_number || d.id, d.resident_name || d.requestor_name || d.resident_id || 'N/A', nice(d.document_type), nice(d.status), dateText(d.downloaded_at || d.released_at || d.claimed_at || d.created_at)]),
    businesses: filtered.businesses.map((b) => [b.permit_number || b.id, b.business_name, b.owner_name || 'N/A', b.business_type || 'N/A', dateText(b.expiry_date)]),
    blotters: filtered.blotters.map((b) => [b.case_number || b.id, b.complainant_name || 'N/A', b.respondent_name || 'N/A', b.incident_type || 'N/A', nice(b.status), dateText(b.incident_date)]),
    medicines: filtered.medicines.map((m) => [m.name, m.category || 'Uncategorized', `${Number(m.quantity || 0)} ${m.unit || ''}`, `${Number(m.reorder_threshold || 0)} ${m.unit || ''}`, Number(m.reorder_threshold || 0) > 0 && Number(m.quantity || 0) <= Number(m.reorder_threshold || 0) ? 'Low stock' : 'Sufficient']),
    welfare: filtered.welfare.map((w) => [w.resident_name || 'N/A', nice(w.program_type), w.assistance_type || 'N/A', money(w.amount), dateText(w.date)]),
  };

  const tableHeads = {
    residents: ['Resident', 'Age', 'Gender', 'Category', 'Household / Address'],
    households: ['Record No.', 'Head', 'Type', 'Members', 'Address'],
    documents: ['Document No.', 'Resident', 'Type', 'Status', 'Release Date'],
    businesses: ['Permit No.', 'Business', 'Owner', 'Type', 'Expiry'],
    blotters: ['Case No.', 'Complainant', 'Respondent', 'Incident', 'Status', 'Date'],
    medicines: ['Medicine', 'Category', 'Stock', 'Reorder At', 'Status'],
    welfare: ['Beneficiary', 'Program', 'Assistance', 'Amount', 'Date'],
  };

  const exportReportPDF = (type) => {
    const report = REPORT_TYPES.find((item) => item.value === type);
    const doc = buildDoc(`${report.label} Report`, range.label);
    let y = addTable(doc, 'Summary', ['Metric', 'Value'], summaries[type], 44);
    addTable(doc, 'Detailed List', tableHeads[type], rows[type], y);
    doc.save(`${type}_report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('PDF report exported');
  };

  const exportAllPDF = () => {
    const doc = buildDoc('Consolidated Barangay Reports', range.label);
    let y = 44;
    REPORT_TYPES.forEach((report, index) => {
      if (index > 0 && y > 155) {
        doc.addPage();
        y = 18;
      }
      y = addTable(doc, report.label, tableHeads[report.value], rows[report.value], y);
    });
    doc.save(`barangay_consolidated_reports_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('Consolidated PDF exported');
  };

  const currentReport = REPORT_TYPES.find((report) => report.value === activeReport);
  const CurrentIcon = currentReport.icon;

  return (
    <PageLayout testId="reports-page">
      <PageHeader
        title="Reports"
        description="Generate professional PDF reports for barangay records, releases, inventory, and welfare programs"
        action={
          <Button onClick={exportAllPDF} disabled={loading} className="bg-primary hover:bg-primary/90 hover:text-white">
            <Download size={16} className="mr-2" /> Export All PDF
          </Button>
        }
      />

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Report Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Calendar Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon size={16} className="mr-2" /> {format(selectedDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <Label>From</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
          {period !== 'custom' && (
            <div className="md:col-span-2 rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm">
              <span className="font-medium">Coverage:</span> {range.label}
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="mr-2 animate-spin" /> Loading report data...
        </Card>
      ) : (
        <Tabs value={activeReport} onValueChange={setActiveReport}>
          <TabsList className="mb-6 flex-wrap h-auto">
            {REPORT_TYPES.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
            ))}
          </TabsList>

          {REPORT_TYPES.map(({ value }) => (
            <TabsContent key={value} value={value}>
              <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-3 rounded-md bg-primary/10"><CurrentIcon className="text-primary" size={22} /></div>
                    <div>
                      <h3 className="font-heading font-semibold">{currentReport.label}</h3>
                      <p className="text-xs text-muted-foreground">PDF-ready barangay report</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {summaries[value].map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="font-heading font-semibold text-primary">{val}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-5 bg-primary hover:bg-primary/90 hover:text-white" onClick={() => exportReportPDF(value)}>
                    <Download size={16} className="mr-2" /> Export This PDF
                  </Button>
                </Card>

                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary">
                        <tr>
                          {tableHeads[value].map((head) => (
                            <th key={head} className="px-5 py-3 text-left text-xs font-semibold uppercase text-secondary-foreground">{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows[value].map((row, index) => (
                          <tr key={`${value}-${index}`} className="hover:bg-accent/40">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-5 py-3 text-sm">{cell || 'N/A'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows[value].length === 0 && (
                      <div className="py-10 text-center text-muted-foreground">No records found for this report.</div>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </PageLayout>
  );
};
>>>>>>> 3716a51 (v1 update for report)
