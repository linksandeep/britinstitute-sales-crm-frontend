import { useEffect, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { getDateTimeInZone, type StatusReminderSchedule, type StatusReminderTimeZone } from '../lib/statusReminder';

interface StatusReminderDialogProps {
  status: string;
  leadName?: string;
  leadCount?: number;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (schedule: StatusReminderSchedule) => void | Promise<void>;
}

const DEFAULT_TIME_ZONE: StatusReminderTimeZone = 'Europe/London';

export default function StatusReminderDialog({
  status,
  leadName,
  leadCount = 1,
  submitting = false,
  onCancel,
  onConfirm
}: StatusReminderDialogProps) {
  const [timeZone, setTimeZone] = useState<StatusReminderTimeZone>(DEFAULT_TIME_ZONE);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const defaultDateTime = getDateTimeInZone(new Date(Date.now() + 60 * 60 * 1000), DEFAULT_TIME_ZONE);
    setTimeZone(DEFAULT_TIME_ZONE);
    setDate(defaultDateTime.date);
    setTime(defaultDateTime.time);
    setValidationError('');
  }, [status, leadName, leadCount]);

  const minimumDate = getDateTimeInZone(new Date(), timeZone).date;

  const handleConfirm = () => {
    if (!date || !time) {
      setValidationError('Choose the next date and time.');
      return;
    }
    setValidationError('');
    void onConfirm({ date, time, timeZone });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="status-reminder-title">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="card-header">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h3 id="status-reminder-title" className="card-title">Schedule {status} reminder</h3>
              <p className="card-subtitle">
                {leadName || `${leadCount} selected lead${leadCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} disabled={submitting} aria-label="Cancel status change">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="card-body space-y-4">
          <p className="text-sm text-gray-600">
            The status will change only after a reminder is scheduled. It will be sent to the assigned CRM user; unassigned leads will remind the user making this change.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="status-reminder-date">Next date</label>
              <input
                id="status-reminder-date"
                type="date"
                className="form-input"
                min={minimumDate}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="status-reminder-time">Next time</label>
              <input
                id="status-reminder-time"
                type="time"
                className="form-input"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="status-reminder-timezone">Time is entered as</label>
            <select
              id="status-reminder-timezone"
              className="form-input"
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value as StatusReminderTimeZone)}
              disabled={submitting}
            >
              <option value="Europe/London">UK time (GMT/BST automatically)</option>
              <option value="Asia/Kolkata">India Standard Time (IST)</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              The CRM converts UK time to the equivalent India time automatically before delivery.
            </p>
          </div>

          {validationError && <p className="text-sm font-semibold text-rose-600">{validationError}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting || !date || !time}>
              {submitting ? 'Scheduling...' : `Schedule & change to ${status}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
