import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Home as HomeIcon,
  Briefcase,
  AlertCircle,
  Heart,
  UserCheck,
  IdCard,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
  Box,
  LogOut,
  Menu,
  X,
  Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { SYSTEM_CONFIG } from '../config/system';
import { hasModuleAccess } from '../config/modules';

const menuItems = [
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'residents', path: '/residents', label: 'Residents', icon: Users },
  { key: 'households', path: '/households', label: 'Households', icon: HomeIcon },
  { key: 'documents', path: '/documents', label: 'Documents', icon: FileText },
  { key: 'portal_requests', path: '/portal-requests', label: 'Online Requests', icon: Globe },
  { key: 'business', path: '/business', label: 'Business', icon: Briefcase },
  { key: 'blotter', path: '/blotter', label: 'Blotter', icon: AlertCircle },
  { key: 'health', path: '/health', label: 'Health', icon: Heart },
  { key: 'medicine_inventory', path: '/medicine-inventory', label: 'Medicine Inventory', icon: Box },
  { key: 'welfare', path: '/welfare', label: 'Social Welfare', icon: UserCheck },
  { key: 'barangay_id', path: '/barangay-id', label: 'Barangay ID', icon: IdCard },
  { key: 'appointments', path: '/appointments', label: 'Appointments', icon: Calendar },
  { key: 'payments', path: '/payments', label: 'Payments', icon: DollarSign },
  { key: 'reports', path: '/reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        data-testid="mobile-menu-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-primary text-white shadow-lg shadow-primary/25"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 sidebar-glass text-white
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.12] ring-1 ring-white/[0.15]">
              <HomeIcon size={22} />
            </div>
            <h1 className="text-xl font-heading font-bold leading-tight">
              {SYSTEM_CONFIG.barangayInfo.name}
            </h1>
            <p className="text-xs text-white/70 mt-1">Management System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto scrollbar-none py-4">
            {menuItems.filter((item) => hasModuleAccess(user, item.key)).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setIsOpen(false)}
                  className={`
                    mx-3 mb-1 flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm transition-all duration-200
                    hover:bg-white/10 hover:text-white
                    ${isActive ? 'bg-white/[0.18] text-white shadow-sm ring-1 ring-white/[0.12] font-semibold' : 'text-white/80'}
                  `}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-white/10">
            <div className="mb-3 rounded-md bg-white/[0.08] px-3 py-3 ring-1 ring-white/10">
              <p className="text-sm font-semibold" data-testid="sidebar-user-name">
                {user?.full_name}
              </p>
              <p className="text-xs text-white/70">{user?.role?.replace('_', ' ')}</p>
            </div>
            <Button
              data-testid="sidebar-logout-button"
              onClick={handleLogout}
              variant="outline"
              className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};
