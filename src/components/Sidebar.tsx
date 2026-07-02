import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  Headphones,
  LayoutDashboard,
  PhoneCall,
  Plug,
  Settings,
  SlidersHorizontal,
  Target,
  Upload,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from './Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  badge?: string;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const sections: NavigationSection[] = [
    {
      label: 'Workspace',
      items: [
        { name: 'Command Center', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Analytics', href: '/analytics', icon: BarChart3, adminOnly: true },
        { name: 'Attendance', href: '/attendance-management', icon: CalendarCheck, adminOnly: true }
      ]
    },
    {
      label: 'Call Center',
      items: [
        { name: 'Phone Calling', href: '/calls', icon: Headphones, badge: 'Live' },
        { name: 'Call History', href: '/calls?view=history', icon: PhoneCall },
        { name: 'Reports', href: '/analytics', icon: SlidersHorizontal, adminOnly: true }
      ]
    },
    {
      label: 'CRM',
      items: [
        { name: 'All Leads', href: '/leads', icon: ClipboardList, adminOnly: true },
        { name: 'My Leads', href: '/my-leads', icon: Target },
        { name: 'Add Lead', href: '/leads/new', icon: UserPlus },
        { name: 'Import Leads', href: '/leads/import', icon: Upload, adminOnly: true },
        { name: 'Assign Leads', href: '/leads/assign', icon: FileSpreadsheet, adminOnly: true }
      ]
    },
    {
      label: 'Administration',
      items: [
        { name: 'Users', href: '/users', icon: UserCheck, adminOnly: true },
        { name: 'Statuses', href: '/statuses', icon: Plug, adminOnly: true },
        { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true }
      ]
    }
  ];

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || user?.role === 'admin')
    }))
    .filter((section) => section.items.length > 0);

  const closeOnMobile = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="flex min-h-full flex-col">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Logo />
            <div>
              <h1 className="sidebar-brand__title">Brit CRM</h1>
              <p className="sidebar-brand__meta">Call Center Suite</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav flex-1" aria-label="Primary navigation">
          {visibleSections.map((section) => (
            <div key={section.label} className="nav-section">
              <div className="nav-section__label">{section.label}</div>
              {section.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.href === '/leads' || item.href === '/dashboard'}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={closeOnMobile}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                    {item.badge && <span className="nav-item__badge">{item.badge}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}

        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
            <div className="min-w-0">
              <p className="sidebar-user__name">{user?.name}</p>
              <p className="sidebar-user__role">{user?.role} account</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
