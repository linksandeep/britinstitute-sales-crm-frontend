import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

type ReminderGroup = 'overdue' | 'today' | 'upcoming';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const groupReminders = (reminders: Reminder[], now: Date) => {
  const today: Reminder[] = [];
  const overdue: Reminder[] = [];
  const upcoming: Reminder[] = [];
  const startToday = startOfDay(now).getTime();
  const startTomorrow = startToday + 24 * 60 * 60 * 1000;

  reminders.forEach((reminder) => {
    if (!reminder.reminderAt) return;
    const date = new Date(reminder.reminderAt);
    if (Number.isNaN(date.getTime())) return;

    if (date.getTime() < startToday) overdue.push(reminder);
    else if (date.getTime() < startTomorrow) today.push(reminder);
    else upcoming.push(reminder);
  });

  return {
    today: today.sort((left, right) => new Date(left.reminderAt!).getTime() - new Date(right.reminderAt!).getTime()),
    overdue: overdue.sort((left, right) => new Date(left.reminderAt!).getTime() - new Date(right.reminderAt!).getTime()),
    upcoming: upcoming.sort((left, right) => new Date(left.reminderAt!).getTime() - new Date(right.reminderAt!).getTime())
  };
};

const ReminderRow: React.FC<{
  reminder: Reminder;
  onAction: (reminder: Reminder, action: 'delete' | 'done' | 'snooze') => void;
  onOpenLead: (leadId: string) => void;
  isBusy: boolean;
  now: Date;
}> = ({ reminder, onAction, onOpenLead, isBusy, now }) => {
  const reminderDate = reminder.reminderAt ? new Date(reminder.reminderAt) : null;
  const isPastDue = Boolean(reminderDate && reminderDate.getTime() < now.getTime());
  const tone = isPastDue
    ? 'border-amber-200 bg-amber-50'
    : 'border-emerald-200 bg-emerald-50';
  const leadId = reminder.lead?._id;

  const openLead = () => {
    if (leadId) onOpenLead(leadId);
  };

  return (
    <div
      className={`list-row mb-2 rounded-lg border px-3 py-2 ${tone} ${leadId ? 'cursor-pointer transition hover:brightness-95' : ''}`}
      role={leadId ? 'link' : undefined}
      tabIndex={leadId ? 0 : undefined}
      onClick={openLead}
      onKeyDown={(event) => {
        if (leadId && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          openLead();
        }
      }}
      title={leadId ? 'Open lead details' : undefined}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Clock className={`h-4 w-4 ${isPastDue ? 'text-amber-600' : 'text-emerald-600'}`} />
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
          onClick={(event) => {
            event.stopPropagation();
            onAction(reminder, 'done');
          }}
          disabled={isBusy}
          title="Mark done"
        >
          <CheckCircle className="h-4 w-4 text-green-600" />
        </button>
        <button
          type="button"
          className="icon-button h-8 w-8"
          onClick={(event) => {
            event.stopPropagation();
            onAction(reminder, 'snooze');
          }}
          disabled={isBusy}
          title="Snooze"
        >
          <BellOff className="h-4 w-4 text-violet-600" />
        </button>
        <button
          type="button"
          className="icon-button h-8 w-8"
          onClick={(event) => {
            event.stopPropagation();
            onAction(reminder, 'delete');
          }}
          disabled={isBusy}
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-rose-600" />
        </button>
      </div>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, reminders, refreshReminders }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [activeReminderGroup, setActiveReminderGroup] = useState<ReminderGroup>('today');
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const profileRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLDivElement>(null);
  const { today, overdue, upcoming } = useMemo(() => groupReminders(reminders, now), [reminders, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const openReminderLead = (leadId: string) => {
    setIsReminderOpen(false);
    navigate(`/leads/${leadId}`);
  };

  const openReminders = () => {
    if (!isReminderOpen) {
      setNow(new Date());
      void refreshReminders?.();
    }
    setIsReminderOpen((current) => !current);
  };

  const displayedReminders = activeReminderGroup === 'overdue'
    ? overdue
    : activeReminderGroup === 'today'
      ? today
      : upcoming;

  const emptyReminderMessage = activeReminderGroup === 'overdue'
    ? 'No overdue reminders'
    : activeReminderGroup === 'today'
      ? 'No reminders scheduled for today'
      : 'No upcoming reminders';

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
            onClick={openReminders}
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
                  <div className="mt-2 flex flex-wrap gap-2" aria-label="Reminder filters">
                    {([
                      ['overdue', overdue.length, 'Overdue'],
                      ['today', today.length, 'Today'],
                      ['upcoming', upcoming.length, 'Upcoming']
                    ] as const).map(([group, count, label]) => (
                      <button
                        key={group}
                        type="button"
                        aria-pressed={activeReminderGroup === group}
                        onClick={() => setActiveReminderGroup(group)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                          activeReminderGroup === group
                            ? group === 'overdue'
                              ? 'border-amber-500 bg-amber-100 text-amber-800'
                              : group === 'today'
                                ? 'border-blue-500 bg-blue-100 text-blue-800'
                                : 'border-emerald-500 bg-emerald-100 text-emerald-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {count} {label.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="max-h-[520px] overflow-y-auto px-4">
                {reminders.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">No reminders scheduled</div>
                ) : displayedReminders.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">{emptyReminderMessage}</div>
                ) : (
                  displayedReminders.map((reminder) => (
                    <ReminderRow
                      key={`${activeReminderGroup}-${reminder._id}`}
                      reminder={reminder}
                      onAction={handleReminderAction}
                      onOpenLead={openReminderLead}
                      isBusy={busyReminderId === reminder._id}
                      now={now}
                    />
                  ))
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
