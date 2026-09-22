export type StatusReminderTimeZone = 'Europe/London' | 'Asia/Kolkata';

export interface StatusReminderSchedule {
  date: string;
  time: string;
  timeZone: StatusReminderTimeZone;
}

export const statusNeedsReminder = (status: string) => {
  const normalized = status.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'followup' || normalized === 'callback';
};

export const getDateTimeInZone = (date: Date, timeZone: StatusReminderTimeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`
  };
};
