import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, X, Bell, AlertTriangle } from 'lucide-react';

interface ReminderNotificationProps {
  reminder: {
    _id: string;
    title: string;
    note?: string;
    reminderAt?: string;
    lead?: { _id: string; name: string };
  };
  onClose: () => void;
  onMarkDone: (id: string) => void;
}

const ReminderNotification: React.FC<ReminderNotificationProps> = ({
  reminder,
  onClose,
  onMarkDone
}) => {
  const navigate = useNavigate();
  const openLead = () => {
    if (!reminder.lead?._id) return;
    onClose();
    navigate(`/leads/${reminder.lead._id}`);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-red-100 border-b border-red-200 rounded-t-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="font-bold text-lg text-red-800">⏰ REMINDER TRIGGERED!</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-200 rounded-full transition"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Bell className="w-5 h-5 text-red-500" />
              <h4 className="font-semibold text-gray-900 text-xl">{reminder.title}</h4>
            </div>
            
            {reminder.note && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Note:</p>
                <div className="bg-white p-4 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-wrap">{reminder.note}</p>
                </div>
              </div>
            )}

            <div className="space-y-3 mt-4">
              {reminder.lead?.name && (
                <button
                  type="button"
                  onClick={openLead}
                  className="flex items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-red-100"
                  title="Open lead details"
                >
                  <span className="text-sm font-medium text-gray-600 min-w-16">Lead:</span>
                  <span className="text-gray-800 underline decoration-red-300 underline-offset-2">{reminder.lead.name}</span>
                </button>
              )}

              {reminder.reminderAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600 min-w-16">Time:</span>
                  <span className="text-gray-800">
                    {new Date(reminder.reminderAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-5 border-t border-red-100">
            <button
              onClick={() => onMarkDone(reminder._id)}
              className="flex-1 px-5 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <span className="text-lg">✅</span>
              <span className="font-semibold">Mark as Done</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors shadow-md"
            >
              Close
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-red-100 text-red-700 text-sm rounded-b-xl border-t border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>This notification will not auto-close. Click buttons above to dismiss.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderNotification;
