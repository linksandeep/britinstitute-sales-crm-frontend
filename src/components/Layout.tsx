import React, { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import Sidebar from './Sidebar';
import socket from '../lib/socket';
import toast from 'react-hot-toast';
import { reminderApi } from '../lib/reminderApi';
import ReminderNotification from '../pages/ReminderNotification';

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

interface ReminderPayload {
  _id?: string;
  reminderId?: string;
  title?: string;
  note?: string;
  remindAt?: string;
  reminderAt?: string;
  createdAt?: string;
  lead?: Reminder['lead'];
}

interface LayoutProps {
  children: ReactNode;
}

const normalizeReminder = (reminder: ReminderPayload): Reminder => ({
  _id: reminder._id || reminder.reminderId || crypto.randomUUID(),
  title: reminder.title || 'Reminder',
  note: reminder.note,
  reminderAt: reminder.remindAt || reminder.reminderAt,
  createdAt: reminder.createdAt,
  lead: reminder.lead
});

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [triggeredReminder, setTriggeredReminder] = useState<Reminder | null>(null);

  const fetchReminders = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsRefreshing(true);
    try {
      const response = await reminderApi.getMyReminders();

      if (response.success && Array.isArray(response.data)) {
        setReminders(response.data.map(normalizeReminder));
      }
    } catch {
      toast.error('Failed to load reminders');
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    if (!user?._id) return;

    if (!socket.connected) {
      socket.connect();
    }

    const joinUserRoom = () => {
      socket.emit('join', user._id);
    };

    const handleReminder = (data: ReminderPayload) => {
      const reminder = normalizeReminder(data);

      try {
        void new Audio('/notification.mp3').play();
      } catch {
        // Browsers can block autoplay; the visual reminder still appears.
      }

      setTriggeredReminder(reminder);
      setReminders((current) => {
        const exists = current.some((item) => item._id === reminder._id);
        return exists ? current : [reminder, ...current];
      });
      toast.success(reminder.title);
    };

    const handleReminderUpdate = (data: ReminderPayload) => {
      const reminder = normalizeReminder(data);
      setReminders((current) =>
        current.map((item) => (item._id === reminder._id ? { ...item, ...reminder } : item))
      );
    };

    const removeReminder = (payload: string | ReminderPayload) => {
      const reminderId = typeof payload === 'string' ? payload : payload?._id || payload?.reminderId;
      if (!reminderId) return;
      setReminders((current) => current.filter((item) => item._id !== reminderId));
    };

    socket.on('connect', joinUserRoom);
    socket.on('reminder', handleReminder);
    socket.on('reminder:update', handleReminderUpdate);
    socket.on('reminder:delete', removeReminder);
    socket.on('reminder:done', removeReminder);
    socket.on('reminder:snooze', handleReminderUpdate);
    joinUserRoom();

    return () => {
      socket.off('connect', joinUserRoom);
      socket.off('reminder', handleReminder);
      socket.off('reminder:update', handleReminderUpdate);
      socket.off('reminder:delete', removeReminder);
      socket.off('reminder:done', removeReminder);
      socket.off('reminder:snooze', handleReminderUpdate);
      socket.emit('leave', user._id);
    };
  }, [user?._id]);

  const markReminderDone = async (reminderId: string) => {
    const response = await reminderApi.updateReminder(reminderId, { action: 'done' } as const);
    if (response.success) {
      setTriggeredReminder(null);
      fetchReminders();
      toast.success('Reminder marked as done');
    }
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading__panel">
          <div className="loading-spinner" />
          Loading workspace
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="crm-shell">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <Header
        onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
        reminders={reminders}
        refreshReminders={fetchReminders}
      />

      {triggeredReminder && (
        <ReminderNotification
          reminder={triggeredReminder}
          onClose={() => setTriggeredReminder(null)}
          onMarkDone={markReminderDone}
        />
      )}

      {isRefreshing && (
        <div className="fixed right-5 top-20 z-30 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
          Syncing reminders
        </div>
      )}

      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
