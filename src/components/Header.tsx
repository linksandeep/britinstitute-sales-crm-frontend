import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell,
  BellOff,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  LogOut,
  Menu,
  PhoneCall,
  Trash2
} from 'lucide-react';
import { reminderApi } from '../lib/reminderApi';
import toast from 'react-hot-toast';
import QuickLeadSearch from './QuickLeadSearch';

interface Reminder {
  _id: string;
  title: string;
  note?: string;
  reminderAt?: string;
  createdAt?: string;
  lead?: {
    _id: string;
    name: string;
    email: string;
  };
}

interface HeaderProps {
  onToggleSidebar: () => void;
  reminders: Reminder[];
  refreshReminders?: () => void;
}

const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
const isPast = (date: Date) => date.getTime() < Date.now();

const groupReminders = (reminders: Reminder[]) => {
  const today: Reminder[] = [];
  const overdue: Reminder[] = [];
  const upcoming: Reminder[] = [];

  reminders.forEach((reminder) => {
    if (!reminder.reminderAt) return;
    const date = new Date(reminder.reminderAt);

    if (isPast(date) && !isToday(date)) overdue.push(reminder);
    else if (isToday(date)) today.push(reminder);
    else upcoming.push(reminder);
  });

  return { today, overdue, upcoming };
};

const ReminderRow: React.FC<{
  reminder: Reminder;
  onAction: (reminder: Reminder, action: 'delete' | 'done' | 'snooze') => void;
  isBusy: boolean;
}> = ({ reminder, onAction, isBusy }) => (
  <div className="list-row">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-blue-600" />
        <p className="truncate text-sm font-bold text-gray-900">{reminder.title}</p>
      </div>
      {reminder.lead && (
        <p className="mt-1 truncate text-xs text-gray-500">
          {reminder.lead.name} {reminder.lead.email ? `- ${reminder.lead.email}` : ''}
        </p>
      )}
      {reminder.reminderAt && (
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(reminder.reminderAt).toLocaleString()}
        </p>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="icon-button h-8 w-8"
        onClick={() => onAction(reminder, 'done')}
        disabled={isBusy}
        title="Mark done"
      >
        <CheckCircle className="h-4 w-4 text-green-600" />
      </button>
      <button
        type="button"
        className="icon-button h-8 w-8"
        onClick={() => onAction(reminder, 'snooze')}
        disabled={isBusy}
        title="Snooze"
      >
        <BellOff className="h-4 w-4 text-violet-600" />
      </button>
      <button
        type="button"
        className="icon-button h-8 w-8"
        onClick={() => onAction(reminder, 'delete')}
        disabled={isBusy}
        title="Delete"
      >
        <Trash2 className="h-4 w-4 text-rose-600" />
      </button>
    </div>
  </div>
);

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, reminders, refreshReminders }) => {
  const { user, logout } = useAuth();
  const { today, overdue, upcoming } = useMemo(() => groupReminders(reminders), [reminders]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }

      if (reminderRef.current && !reminderRef.current.contains(event.target as Node)) {
        setIsReminderOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReminderAction = async (reminder: Reminder, action: 'delete' | 'done' | 'snooze') => {
    setBusyReminderId(reminder._id);

    try {
      if (action === 'delete') {
        const response = await reminderApi.deleteReminder(reminder._id);
        if (!response.success) throw new Error(response.message || 'Failed to delete reminder');
        toast.success('Reminder deleted');
      }

      if (action === 'done') {
        const response = await reminderApi.updateReminder(reminder._id, { action: 'done' } as const);
        if (!response.success) throw new Error(response.message || 'Failed to update reminder');
        toast.success('Reminder marked as done');
      }

      if (action === 'snooze') {
        const snoozeDate = new Date(reminder.reminderAt || Date.now());
        snoozeDate.setHours(snoozeDate.getHours() + 1, 0, 0, 0);
        const response = await reminderApi.updateReminder(reminder._id, {
          action: 'snooze',
          snoozeUntil: snoozeDate.toISOString()
        } as const);
        if (!response.success) throw new Error(response.message || 'Failed to snooze reminder');
        toast.success('Reminder snoozed for 1 hour');
      }

      refreshReminders?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reminder action failed');
    } finally {
      setBusyReminderId(null);
    }
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await logout();
  };

  return (
    <header className="header">
      <div className="header__left">
        <button type="button" className="icon-button lg:hidden" onClick={onToggleSidebar} title="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <div className="header__status">
          <span className="header__live-dot" />
          <PhoneCall className="h-4 w-4" />
          <span>Phone Calling Active</span>
        </div>
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <QuickLeadSearch className="max-w-lg" />
      </div>

      <div className="header__right">
        <div className="relative" ref={reminderRef}>
          <button
            type="button"
            className="icon-button relative"
            onClick={() => setIsReminderOpen((current) => !current)}
            title="Open reminders"
          >
            <Bell className="h-5 w-5" />
            {reminders.length > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {reminders.length}
              </span>
            )}
          </button>

          {isReminderOpen && (
            <div className="absolute right-0 z-50 mt-3 w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Reminders</h3>
                  <p className="card-subtitle">
                    {overdue.length} overdue &middot; {today.length} today &middot; {upcoming.length} upcoming
                  </p>
                </div>
              </div>
              <div className="max-h-[520px] overflow-y-auto px-4">
                {reminders.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">No reminders scheduled</div>
                ) : (
                  <>
                    {overdue.map((reminder) => (
                      <ReminderRow
                        key={`overdue-${reminder._id}`}
                        reminder={reminder}
                        onAction={handleReminderAction}
                        isBusy={busyReminderId === reminder._id}
                      />
                    ))}
                    {today.map((reminder) => (
                      <ReminderRow
                        key={`today-${reminder._id}`}
                        reminder={reminder}
                        onAction={handleReminderAction}
                        isBusy={busyReminderId === reminder._id}
                      />
                    ))}
                    {upcoming.map((reminder) => (
                      <ReminderRow
                        key={`upcoming-${reminder._id}`}
                        reminder={reminder}
                        onAction={handleReminderAction}
                        isBusy={busyReminderId === reminder._id}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm transition hover:bg-gray-50"
            onClick={() => setIsProfileOpen((current) => !current)}
          >
            <span className="avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
            <span className="hidden min-w-0 text-left md:block">
              <span className="block max-w-[140px] truncate text-sm font-bold text-gray-900">{user?.name}</span>
              <span className="block text-xs capitalize text-gray-500">{user?.role}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 z-50 mt-3 w-60 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="truncate text-sm font-bold text-gray-900">{user?.name}</p>
                <p className="truncate text-sm text-gray-500">{user?.email}</p>
                <p className="mt-1 text-xs font-semibold capitalize text-gray-400">{user?.role} account</p>
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
