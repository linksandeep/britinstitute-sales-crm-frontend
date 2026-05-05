import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Menu,
  LogOut,
  ChevronDown,
  Bell,
  Clock,
  Edit,
  Trash2,
  CheckCircle,
  BellOff,
  Calendar
} from 'lucide-react';
import { reminderApi, type UpdateReminderDetailsPayload } from '../lib/reminderApi';
import toast from 'react-hot-toast';
// import { attendanceApi } from '../lib/api';

/* ================= TYPES ================= */
interface Reminder {
  _id: string;
  title: string;
  note?: string;
  reminderAt?: string;
  createdAt?: string;
  lead?: {
    _id: string;
    name: string;
    email:string
  };
}


interface HeaderProps {
  onToggleSidebar: () => void;
  reminders: Reminder[];
  refreshReminders?: () => void;
}

const now = new Date();

const isToday = (date: Date) =>
  date.toDateString() === now.toDateString();

const isPast = (date: Date) =>
  date.getTime() < now.getTime();

const groupReminders = (reminders: Reminder[]) => {
  const today: Reminder[] = [];
  const overdue: Reminder[] = [];
  const upcoming: Reminder[] = [];

  reminders.forEach(r => {
    if (!r.reminderAt) return;
    const date = new Date(r.reminderAt);

    if (isToday(date)) today.push(r);
    else if (isPast(date)) overdue.push(r);
    else upcoming.push(r);
  });

  return { today, overdue, upcoming };
};

/* ================= REMINDER ITEM COMPONENT =================  this is for tund of for some second */


export const ReminderItem: React.FC<{
  reminder: Reminder;
  onOpen?: (r: Reminder) => void;
  onRefresh?: () => void;
  showActions?: boolean;
}> = ({ reminder, onOpen, onRefresh, showActions = true }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSnoozeTime, setLastSnoozeTime] = useState<number>(0);
  const [isCooldown, setIsCooldown] = useState(false);

  const handleAction = async (action: 'delete' | 'done' | 'snooze') => {
    if (!reminder._id) return;
    
    // Check cooldown for snooze
    if (action === 'snooze') {
      const now = Date.now();
      const timeSinceLastClick = now - lastSnoozeTime;
      const COOLDOWN_MS = 5000; // 5 seconds cooldown
      
      if (timeSinceLastClick < COOLDOWN_MS) {
        toast.error(`Please wait ${Math.ceil((COOLDOWN_MS - timeSinceLastClick) / 1000)} seconds before snoozing again`);
        return;
      }
      
      setLastSnoozeTime(now);
      setIsCooldown(true);
      
      // Reset cooldown after 5 seconds
      setTimeout(() => {
        setIsCooldown(false);
      }, COOLDOWN_MS);
    }
    
    setIsLoading(true);
    try {
      let res;
      let snoozeUntil = '';
      
      switch (action) {
        case 'delete':
          res = await reminderApi.deleteReminder(reminder._id);
          if (res.success) {
            toast.success('Reminder deleted');
            onRefresh?.();
          } else {
            toast.error(res.message || 'Failed to delete reminder');
          }
          break;
          
        case 'done':
          res = await reminderApi.updateReminder(reminder._id, { action: 'done' } as const);
          if (res.success) {
            toast.success('Reminder marked as done');
            onRefresh?.();
          } else {
            toast.error(res.message || 'Failed to mark reminder as done');
          }
          break;
          
        case 'snooze':
          // Get current reminder time or now
          const currentTime = reminder.reminderAt ? new Date(reminder.reminderAt) : new Date();
          
          // Always snooze from the CURRENT reminder time, not from now
          // This prevents multiple clicks from not updating
          const oneHourLater = new Date(currentTime.getTime() + 60 * 60 * 1000);
          oneHourLater.setSeconds(0, 0);
          snoozeUntil = oneHourLater.toISOString();
          
          console.log('Snoozing reminder:', {
            id: reminder._id,
            from: currentTime.toISOString(),
            to: snoozeUntil
          });
          
          res = await reminderApi.updateReminder(reminder._id, { 
            action: 'snooze', 
            snoozeUntil 
          } as const);
          
          if (res.success) {
            toast.success('Reminder snoozed for 1 hour');
            console.log('Backend response:', res.data);
            
            // Update locally immediately
            if (res.data && res.data.reminder) {
              // If backend returns updated reminder, update local state
              // const updatedReminder = res.data.reminder;
              // You might need to pass this up to parent
            }
            
            // Force refresh after 1 second to ensure backend updated
            setTimeout(() => {
              onRefresh?.();
            }, 1000);
          } else {
            toast.error(res.message || 'Failed to snooze reminder');
            // Reset cooldown on failure
            setIsCooldown(false);
          }
          break;
      }
    } catch (err: any) {
      console.error(`${action} error:`, err);
      toast.error(`Failed to ${action} reminder: ${err.message || 'Unknown error'}`);
      // Reset cooldown on error
      if (action === 'snooze') {
        setIsCooldown(false);
      }
    } finally {
      setIsLoading(false);
    }
  };





  

  const getTimeColor = () => {
    if (!reminder.reminderAt) return 'text-gray-500';
    const date = new Date(reminder.reminderAt);
    if (isPast(date)) return 'text-red-500';
    if (isToday(date)) return 'text-orange-500';
    return 'text-blue-500';
  };

  return (
    <div
      className="px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => onOpen?.(reminder)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div className="text-sm font-medium text-gray-900">{reminder.title}</div>
          </div>
          {/* Lead name & email */}
{reminder.lead && (
  <div className="ml-6 mt-1 text-xs text-gray-700 flex flex-col gap-0.5">
    <span className="font-medium">
      {reminder.lead.name}
    </span>

    {reminder.lead.email && (
      <span className="text-gray-500">
        {reminder.lead.email}
      </span>
    )}
  </div>
)}

          {reminder.note && (
            <div className="text-xs text-gray-600 mt-1 ml-6 line-clamp-1">
              {reminder.note}
            </div>
          )}
          <div className={`text-xs mt-1 ml-6 ${getTimeColor()}`}>
            <Calendar className="w-3 h-3 inline mr-1" />
            {reminder.reminderAt ? new Date(reminder.reminderAt).toLocaleString() : ''}
            {reminder.reminderAt && (
              <span className="text-xs text-gray-400 ml-2">
                ({new Date(reminder.reminderAt).toISOString()})
              </span>
            )}
          </div>
        </div>
        
        {showActions && (
          <div className="flex gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
            <button
              className={`p-1 rounded hover:bg-green-50 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleAction('done')}
              disabled={isLoading}
              title="Mark as done"
            >
              <CheckCircle className="w-4 h-4 text-green-600" />
            </button>
            <button
              className={`p-1 rounded hover:bg-purple-50 ${isLoading || isCooldown ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleAction('snooze')}
              disabled={isLoading || isCooldown}
              title={isCooldown ? "Please wait before snoozing again" : "Snooze for 1 hour"}
            >
              <BellOff className="w-4 h-4 text-purple-600" />
              {isCooldown && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[8px] px-1 rounded-full">
                  ⌛
                </span>
              )}
            </button>
            <button
              className={`p-1 rounded hover:bg-red-50 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleAction('delete')}
              disabled={isLoading}
              title="Delete reminder"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ================= REMINDER DETAILS MODAL ================= */
const ReminderDetailsModal: React.FC<{
  reminder: Reminder | null;
  onClose: () => void;
  onEdit: (reminder: Reminder) => void;
  onRefresh?: () => void;
}> = ({ reminder, onClose, onEdit, onRefresh }) => {
  if (!reminder) return null;

  const handleDelete = async () => {
    if (!reminder._id) return;
    try {
      const res = await reminderApi.deleteReminder(reminder._id);
      if (res.success) {
        toast.success('Reminder deleted');
        onRefresh?.();
        onClose();
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete reminder');
    }
  };

  const handleMarkDone = async () => {
    if (!reminder._id) return;
    try {
      const res = await reminderApi.updateReminder(reminder._id, { action: 'done' } as const);
      if (res.success) {
        toast.success('Reminder marked as done');
        onRefresh?.();
        onClose();
      }
    } catch (err) {
      console.error('Mark done error:', err);
      toast.error('Failed to mark reminder as done');
    }
  };

  const handleSnooze = async () => {
    if (!reminder._id) return;
    try {
      // Create a clean date 1 hour from now without seconds
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      oneHourLater.setSeconds(0, 0);
      const snoozeUntil = oneHourLater.toISOString();
      
      const res = await reminderApi.updateReminder(reminder._id, { 
        action: 'snooze', 
        snoozeUntil 
      } as const);
      if (res.success) {
        toast.success('Reminder snoozed for 1 hour');
        onRefresh?.();
        onClose();
      }
    } catch (err) {
      console.error('Snooze error:', err);
      toast.error('Failed to snooze reminder');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Reminder Details</h3>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Title</label>
            <p className="text-gray-900 font-medium mt-1 p-2 bg-gray-50 rounded">
              {reminder.title}
            </p>
          </div>
          {typeof reminder.lead === 'object' && reminder.lead && (
  <div>
    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
      Lead
    </label>
    <div className="mt-1 p-2 bg-gray-50 rounded">
      <p className="text-sm font-medium text-gray-800">
        {reminder.lead.name}
      </p>
      {reminder.lead.email && (
        <p className="text-xs text-gray-600">
          {reminder.lead.email}
        </p>
      )}
    </div>
  </div>
)}


          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reminder Time</label>
              <p className="text-gray-700 mt-1 p-2 bg-gray-50 rounded">
                {reminder.reminderAt
                  ? new Date(reminder.reminderAt).toLocaleString()
                  : 'Not set'}
              </p>
            </div>
            {reminder.createdAt && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</label>
                <p className="text-gray-700 mt-1 p-2 bg-gray-50 rounded">
                  {new Date(reminder.createdAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-2 p-6 pt-4 border-t">
          <button
            className="flex-1 min-w-[120px] px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="flex-1 min-w-[120px] px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={() => onEdit(reminder)}
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            className="flex-1 min-w-[120px] px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={handleSnooze}
          >
            <BellOff className="w-4 h-4" />
            Snooze
          </button>
          <button
            className="flex-1 min-w-[120px] px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={handleMarkDone}
          >
            <CheckCircle className="w-4 h-4" />
            Mark Done
          </button>
          <button
            className="flex-1 min-w-[120px] px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

/* ================= EDIT REMINDER MODAL ================= */
const EditReminderModal: React.FC<{
  reminder: Reminder | null;
  onClose: () => void;
  onSave: (data: { title: string; note?: string; reminderAt: string }) => void;
}> = ({ reminder, onClose, onSave }) => {
  const [title, setTitle] = useState(reminder?.title || '');
  const [note, setNote] = useState(reminder?.note || '');
  const [reminderAt, setReminderAt] = useState(
    reminder?.reminderAt ? new Date(reminder.reminderAt).toISOString().slice(0, 16) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reminderAt) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({ title, note: note.trim() || undefined, reminderAt });
      toast.success('Reminder updated successfully');
      onClose();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!reminder) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Edit className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Edit Reminder</h3>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter reminder title"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add a note (optional)"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reminder Date & Time *
            </label>
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ================= HEADER COMPONENT ================= */
const Header: React.FC<HeaderProps> = ({ onToggleSidebar, reminders, refreshReminders }) => {
  const { today, overdue, upcoming } = groupReminders(reminders);
  const { user, logout } = useAuth();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLDivElement>(null);
  /*
   * Attendance clock-in/out is disabled for lead management access.
   * Users can now use the lead app without enrolling in attendance.
   *
   * const [isClockedIn, setIsClockedIn] = useState(false);
   * const [attendanceLoading, setAttendanceLoading] = useState(false);
   * const [todayHours, setTodayHours] = useState<number>(0);
   * const [liveSeconds, setLiveSeconds] = useState<number>(0);
   * const [_checkingStatus, setCheckingStatus] = useState(true);
   *
   * const formatTime = (totalHours: number) => {
   *   const totalSeconds = Math.floor(totalHours * 3600) + liveSeconds;
   *   const hrs = Math.floor(totalSeconds / 3600);
   *   const mins = Math.floor((totalSeconds % 3600) / 60);
   *   const secs = totalSeconds % 60;
   *   return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
   * };
   *
   * useEffect(() => {
   *   const checkInitialStatus = async () => {
   *     try {
   *       const response = await attendanceApi.getStatus();
   *       if (response.success && response.data) {
   *         setIsClockedIn(response.data.isClockedIn);
   *         if (response.data.isClockedIn && response.data.checkInTime) {
   *           const checkInDate = new Date(response.data.checkInTime);
   *           const now = new Date();
   *           const diffInSeconds = Math.floor((now.getTime() - checkInDate.getTime()) / 1000);
   *           setLiveSeconds(diffInSeconds > 0 ? diffInSeconds : 0);
   *         }
   *       }
   *     } catch (error) {
   *       console.error("Failed to sync attendance status", error);
   *     } finally {
   *       setCheckingStatus(false);
   *     }
   *   };
   *
   *   checkInitialStatus();
   * }, []);
   *
   * useEffect(() => {
   *   let interval: any;
   *   if (isClockedIn) {
   *     interval = setInterval(() => {
   *       setLiveSeconds((prev) => prev + 1);
   *     }, 1000);
   *   } else {
   *     setLiveSeconds(0);
   *   }
   *   return () => clearInterval(interval);
   * }, [isClockedIn]);
   *
   * const fetchWorkHours = async () => {
   *   const res = await attendanceApi.getWorkHours();
   *   if (res.success && res.data) {
   *     setTodayHours(res.data.totalHours);
   *   }
   * };
   *
   * useEffect(() => {
   *   fetchWorkHours();
   * }, []);
   *
   * const handleAttendanceAction = async () => {
   *   setAttendanceLoading(true);
   *   try {
   *     navigator.geolocation.getCurrentPosition(
   *       async (position) => {
   *         const { latitude, longitude } = position.coords;
   *         if (!isClockedIn) {
   *           const res = await attendanceApi.clockIn(latitude, longitude);
   *           if (res.success) {
   *             setIsClockedIn(true);
   *             toast.success("Clocked in successfully!");
   *             fetchWorkHours();
   *           } else {
   *             toast.error(res.message || "Clock-in failed");
   *           }
   *         } else {
   *           const res = await attendanceApi.clockOut(latitude, longitude);
   *           if (res.success) {
   *             setIsClockedIn(false);
   *             setLiveSeconds(0);
   *             toast.success("Clocked out successfully!");
   *             fetchWorkHours();
   *           } else {
   *             toast.error(res.message || "Clock-out failed");
   *           }
   *         }
   *         setAttendanceLoading(false);
   *       },
   *       (_error) => {
   *         toast.error("Location access is required for attendance.");
   *         setAttendanceLoading(false);
   *       },
   *       { enableHighAccuracy: true }
   *     );
   *   } catch (err) {
   *     toast.error("An unexpected error occurred");
   *     setAttendanceLoading(false);
   *   }
   * };
   */
  /* ========== CLOSE DROPDOWNS ON OUTSIDE CLICK ========== */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (reminderRef.current && !reminderRef.current.contains(event.target as Node)) {
        setShowReminderModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ========== LOGOUT ========== */
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

 // In Header component
// In Header.tsx, the handleEditReminder function should use:
const handleEditReminder = async (data: UpdateReminderDetailsPayload) => {
  try {
    if (!editingReminder?._id) return;
    
    const res = await reminderApi.updateReminderDetails(editingReminder._id, data);
    
    if (res.success) {
      toast.success('Reminder updated successfully');
      refreshReminders?.();
      setEditingReminder(null);
      setSelectedReminder(null);
    } else {
      toast.error(res.message || 'Failed to update reminder');
    }
  } catch (error) {
    console.error('Edit error:', error);
    toast.error('Failed to update reminder');
  }
};

  /* ================= UI ================= */
  return (
    <header className="header flex items-center justify-between">
      {/* LEFT */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4">
        
{/* Attendance clock-in/out hidden for lead management access. */}
{/*
<div className="flex items-center gap-3 mr-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
          <div className="flex flex-col items-end px-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 leading-none">
              {isClockedIn ? 'Live Session' : 'Today Total'}
            </span>
            <span className={`text-sm font-mono font-bold ${isClockedIn ? 'text-green-600' : 'text-blue-600'}`}>
              {isClockedIn ? formatTime(todayHours) : `${todayHours.toFixed(2)} hrs`}
            </span>
          </div>

          <button
            onClick={handleAttendanceAction}
            disabled={attendanceLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm border ${
              isClockedIn 
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                : 'bg-green-600 text-white border-green-700 hover:bg-green-700'
            }`}
          >
            {attendanceLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
            ) : isClockedIn ? (
              <><LogOut className="w-4 h-4" /> <span className="hidden md:inline">Clock Out</span></>
            ) : (
              <><Clock className="w-4 h-4" /> <span className="hidden md:inline">Clock In</span></>
            )}
          </button>
        </div>
*/}
        {/* 🔔 REMINDER BELL */}
        <div className="relative" ref={reminderRef}>
          <button
            onClick={() => setShowReminderModal(true)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {reminders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                {reminders.length}
              </span>
            )}
          </button>

          {/* REMINDER MODAL */}
          {showReminderModal && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div
                className="bg-white w-full max-w-lg rounded-xl shadow-xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">All Reminders</h3>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {reminders.length} total
                    </span>
                  </div>
                  <button
                    className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-200"
                    onClick={() => setShowReminderModal(false)}
                  >
                    ✕
                  </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto">
                  {/* OVERDUE */}
                  {overdue.length > 0 && (
                    <div>
                      <div className="px-6 py-3 text-sm font-medium text-red-600 bg-red-50 border-b flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                        Overdue ({overdue.length})
                      </div>
                      {overdue.map((r) => (
                        <ReminderItem
                          key={`overdue-${r._id}`}
                          reminder={r}
                          onOpen={(rem) => {
                            setSelectedReminder(rem);
                            setShowReminderModal(false);
                          }}
                          onRefresh={refreshReminders}
                        />
                      ))}
                    </div>
                  )}

                  {/* TODAY */}
                  {today.length > 0 && (
                    <div>
                      <div className="px-6 py-3 text-sm font-medium text-orange-600 bg-orange-50 border-b flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        Today ({today.length})
                      </div>
                      {today.map((r) => (
                        <ReminderItem
                          key={`today-${r._id}`}
                          reminder={r}
                          onOpen={(rem) => {
                            setSelectedReminder(rem);
                            setShowReminderModal(false);
                          }}
                          onRefresh={refreshReminders}
                        />
                      ))}
                    </div>
                  )}

                  {/* UPCOMING */}
                  {upcoming.length > 0 && (
                    <div>
                      <div className="px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 border-b flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        Upcoming ({upcoming.length})
                      </div>
                      {upcoming.map((r) => (
                        <ReminderItem
                          key={`upcoming-${r._id}`}
                          reminder={r}
                          onOpen={(rem) => {
                            setSelectedReminder(rem);
                            setShowReminderModal(false);
                          }}
                          onRefresh={refreshReminders}
                        />
                      ))}
                    </div>
                  )}

                  {reminders.length === 0 && (
                    <div className="p-8 text-center">
                      <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No reminders yet</p>
                      <p className="text-sm text-gray-400 mt-1">Create your first reminder to get started</p>
                    </div>
                  )}
                </div>

                {/* FOOTER */}
                <div className="border-t px-6 py-4 bg-gray-50">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                        Overdue: {overdue.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        Today: {today.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        Upcoming: {upcoming.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 👤 PROFILE (UNCHANGED) */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            className="flex items-center gap-3 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setIsProfileOpen(prev => !prev)}
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {user?.name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role}
              </p>
            </div>

            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {user?.name}
                </p>
                <p className="text-sm text-gray-500">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-400 capitalize mt-1">
                  {user?.role} Account
                </p>
              </div>

              <div className="border-t border-gray-100 py-1">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => {
                    setIsProfileOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REMINDER DETAILS MODAL */}
      <ReminderDetailsModal
        reminder={selectedReminder}
        onClose={() => setSelectedReminder(null)}
        onEdit={setEditingReminder}
        onRefresh={refreshReminders}
      />

    {/* EDIT REMINDER MODAL */}
    <EditReminderModal
        reminder={editingReminder}
        onClose={() => setEditingReminder(null)}
        onSave={handleEditReminder}
      /> 
    </header>
  );
};

export default Header;
