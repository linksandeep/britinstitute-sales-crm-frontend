import type { DashboardStats } from '../types';

export type CallDirection = 'Incoming' | 'Outgoing';
export type CallStatus = 'Connected' | 'Missed' | 'Queued' | 'Voicemail' | 'In Progress';
export type CallOutcome = 'Qualified' | 'Follow-up' | 'Not Interested' | 'Wrong Number' | 'Converted' | 'Pending';

export interface CallRecord {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  direction: CallDirection;
  status: CallStatus;
  outcome: CallOutcome;
  disposition: string;
  durationSeconds: number;
  agent: string;
  startedAt: string;
  queue: string;
  tags: string[];
  notes: string;
  recordingUrl?: string;
  followUpAt?: string;
}

export interface CallQueueItem {
  id: string;
  caller: string;
  phone: string;
  waitSeconds: number;
  priority: 'High' | 'Normal' | 'Low';
  source: string;
}

export interface ActiveCall {
  id: string;
  customerName: string;
  phone: string;
  agent: string;
  elapsedSeconds: number;
  direction: CallDirection;
}

export interface IntegrationRoadmapItem {
  name: string;
  status: 'Ready Slot' | 'Next Phase' | 'Planned';
  description: string;
}

export interface CallCenterSnapshot {
  records: CallRecord[];
  activeCalls: ActiveCall[];
  queue: CallQueueItem[];
  roadmap: IntegrationRoadmapItem[];
  lastUpdated: string;
}

export const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const formatTalkTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const buildCallCenterSnapshot = (stats?: DashboardStats | null): CallCenterSnapshot => {
  return {
    records: [],
    activeCalls: [],
    queue: [],
    roadmap: [
      {
        name: 'Phone Calling',
        status: 'Ready Slot',
        description: 'UI is prepared for real call records once the phone service exposes an API.'
      },
      {
        name: 'Call Recordings',
        status: 'Ready Slot',
        description: 'Recording playback is hidden until real recording URLs are returned.'
      },
      {
        name: 'AI Call Summaries',
        status: 'Planned',
        description: 'The activity model can accept summary, disposition, and next-action fields.'
      },
      {
        name: 'Zoom Phone Enhancements',
        status: 'Next Phase',
        description: 'Reserved for additional phone reports, recording intelligence, and channel analytics.'
      }
    ],
    lastUpdated: stats?.lastUpdated ?? new Date().toISOString()
  };
};
