import type { Lead } from '../types';

export type DateField = 'createdAt' | 'updatedAt';
export type PresetRange = 'today' | '7d' | '30d' | '90d' | 'week' | 'month' | 'all' | 'custom';

export interface DateFilterState {
  fromDate: string;
  toDate: string;
}

export const getLocalDateInputValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

export const getTimezoneOffsetParam = () => new Date().getTimezoneOffset().toString();

export const isDateFilterActive = (range: DateFilterState) => Boolean(range.fromDate || range.toDate);

export const getPresetDateRange = (preset: PresetRange): DateFilterState => {
  if (preset === 'all') {
    return { fromDate: '', toDate: '' };
  }

  const now = new Date();
  const start = new Date(now);

  if (preset === 'today') {
    return { fromDate: getLocalDateInputValue(now), toDate: getLocalDateInputValue(now) };
  }

  if (preset === 'week') {
    start.setDate(now.getDate() - now.getDay());
    return { fromDate: getLocalDateInputValue(start), toDate: getLocalDateInputValue(now) };
  }

  if (preset === 'month') {
    start.setDate(1);
    return { fromDate: getLocalDateInputValue(start), toDate: getLocalDateInputValue(now) };
  }

  const days = preset === '7d' ? 6 : preset === '90d' ? 89 : 29;
  start.setDate(now.getDate() - days);
  return { fromDate: getLocalDateInputValue(start), toDate: getLocalDateInputValue(now) };
};

export const toLeadDateFilterParams = (range: DateFilterState, dateField: DateField = 'createdAt') => {
  if (!isDateFilterActive(range)) return {};

  return {
    fromDate: range.fromDate || undefined,
    toDate: range.toDate || undefined,
    dateField,
    timezoneOffsetMinutes: getTimezoneOffsetParam()
  };
};

export const isLeadInDateRange = (lead: Lead, range: DateFilterState, dateField: DateField = 'createdAt') => {
  if (!isDateFilterActive(range)) return true;

  const value = lead[dateField];
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  if (range.fromDate) {
    const [year, month, day] = range.fromDate.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    if (timestamp < start) return false;
  }

  if (range.toDate) {
    const [year, month, day] = range.toDate.split('-').map(Number);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
    if (timestamp > end) return false;
  }

  return true;
};
