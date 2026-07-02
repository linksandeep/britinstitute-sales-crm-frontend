import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Headphones,
  Mic,
  Pause,
  PhoneCall,
  Play,
  RefreshCw,
  Search,
  Tag,
  UserRound,
  Voicemail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi, leadApi } from '../lib/api';
import type { DashboardStats, Lead } from '../types';
import {
  buildCallCenterSnapshot,
  formatDuration,
  type CallDirection,
  type CallOutcome,
  type CallStatus
} from '../lib/callCenterData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const statusClass = (status: CallStatus) => {
  if (status === 'Connected') return 'status-pill status-pill--green';
  if (status === 'Missed') return 'status-pill status-pill--rose';
  if (status === 'In Progress') return 'status-pill status-pill--blue';
  if (status === 'Queued') return 'status-pill status-pill--amber';
  return 'status-pill status-pill--slate';
};

const outcomeClass = (outcome: CallOutcome) => {
  if (outcome === 'Converted' || outcome === 'Qualified') return 'status-pill status-pill--green';
  if (outcome === 'Follow-up') return 'status-pill status-pill--amber';
  if (outcome === 'Not Interested' || outcome === 'Wrong Number') return 'status-pill status-pill--rose';
  return 'status-pill status-pill--slate';
};

const directionClass = (direction: CallDirection) =>
  direction === 'Incoming' ? 'status-pill status-pill--violet' : 'status-pill status-pill--blue';

const Calls: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'All'>('All');
  const [directionFilter, setDirectionFilter] = useState<CallDirection | 'All'>('All');
  const [outcomeFilter, setOutcomeFilter] = useState<CallOutcome | 'All'>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [callQueueLeads, setCallQueueLeads] = useState<Lead[]>([]);
  const debouncedQuery = useDebouncedValue(query, 220);
  const snapshot = useMemo(() => buildCallCenterSnapshot(stats), [stats]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const [statsResponse, queueResponse] = await Promise.all([
      user?.role === 'admin' ? dashboardApi.getAdminStats() : dashboardApi.getStats(),
      user?.role === 'admin'
        ? leadApi.getLeads({ status: ['New', 'Follow-up', 'Call Back'] }, 1, 8)
        : leadApi.getMyLeads(1, 8)
    ]);

    if (statsResponse.success && statsResponse.data) {
      setStats(statsResponse.data);
    }

    if (queueResponse.success && queueResponse.data) {
      setCallQueueLeads(queueResponse.data);
    }

    setLoading(false);
  }, [user?.role]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();

    return snapshot.records.filter((record) => {
      const matchesSearch =
        !normalizedQuery ||
        record.customerName.toLowerCase().includes(normalizedQuery) ||
        record.phone.toLowerCase().includes(normalizedQuery) ||
        record.email.toLowerCase().includes(normalizedQuery) ||
        record.agent.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === 'All' || record.status === statusFilter;
      const matchesDirection = directionFilter === 'All' || record.direction === directionFilter;
      const matchesOutcome = outcomeFilter === 'All' || record.outcome === outcomeFilter;

      return matchesSearch && matchesStatus && matchesDirection && matchesOutcome;
    });
  }, [debouncedQuery, directionFilter, outcomeFilter, snapshot.records, statusFilter]);

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !filteredRecords.some((record) => record.id === selectedId)) {
      setSelectedId(filteredRecords[0].id);
    }
  }, [filteredRecords, selectedId]);

  const selectedRecord = filteredRecords.find((record) => record.id === selectedId) || snapshot.records[0];
  const unassignedQueueCount = callQueueLeads.filter((lead) => !lead.assignedTo && !lead.assignedToUser).length;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">
            <PhoneCall className="h-4 w-4" />
            Phone Calling
          </div>
          <h1 className="page-title">Call Management</h1>
          <p className="page-description">
            Manage the real phone-calling worklist from your CRM leads. Call history will appear here only when
            the phone service exposes real call records.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link to={callQueueLeads[0]?._id ? `/leads/${callQueueLeads[0]._id}` : '/leads'} className="btn btn-primary">
            <PhoneCall className="h-4 w-4" />
            Open Next Lead
          </Link>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card metric-card--blue">
          <div className="metric-card__top">
            <p className="metric-card__label">Ready To Call</p>
            <Headphones className="h-5 w-5" />
          </div>
          <p className="metric-card__value">{loading ? '...' : callQueueLeads.length}</p>
          <p className="metric-card__change">Real leads in calling queue</p>
        </div>
        <div className="metric-card metric-card--green">
          <div className="metric-card__top">
            <p className="metric-card__label">Contacted Leads</p>
            <CheckCircle className="h-5 w-5" />
          </div>
          <p className="metric-card__value">{stats?.contactedLeads ?? 0}</p>
          <p className="metric-card__change">From current CRM status data</p>
        </div>
        <div className="metric-card metric-card--rose">
          <div className="metric-card__top">
            <p className="metric-card__label">Unassigned Queue</p>
            <Voicemail className="h-5 w-5" />
          </div>
          <p className="metric-card__value">{unassignedQueueCount}</p>
          <p className="metric-card__change">Needs manager assignment</p>
        </div>
        <div className="metric-card metric-card--amber">
          <div className="metric-card__top">
            <p className="metric-card__label">Call Records</p>
            <Clock className="h-5 w-5" />
          </div>
          <p className="metric-card__value">{filteredRecords.length}</p>
          <p className="metric-card__change">No fake history displayed</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Ready To Call</h2>
            <p className="card-subtitle">Real leads from New, Follow-up, and Call Back status queues</p>
          </div>
          <span className="status-pill status-pill--blue">{callQueueLeads.length} leads</span>
        </div>
        <div className="card-body">
          {callQueueLeads.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              {callQueueLeads.map((lead) => (
                <Link
                  key={lead._id}
                  to={`/leads/${lead._id}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-gray-900">{lead.name}</p>
                      <p className="truncate text-sm text-gray-500">{lead.phone}</p>
                    </div>
                    <span className="status-pill status-pill--amber">{lead.status}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <p className="font-bold uppercase">Owner</p>
                      <p className="truncate text-sm font-semibold normal-case text-gray-800">
                        {lead.assignedToUser?.name || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold uppercase">Source</p>
                      <p className="truncate text-sm font-semibold normal-case text-gray-800">{lead.source}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <Headphones className="mx-auto h-10 w-10 text-gray-300" />
              <h3 className="mt-3 text-lg font-extrabold text-gray-900">No leads waiting in the calling queue</h3>
              <p className="mt-1 text-sm text-gray-500">
                Leads with New, Follow-up, or Call Back status will appear here automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                className="form-input pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customer, phone, email, or agent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CallStatus | 'All')}
              className="form-input"
              aria-label="Call status"
            >
              <option value="All">All statuses</option>
              <option value="Connected">Connected</option>
              <option value="Missed">Missed</option>
              <option value="Queued">Queued</option>
              <option value="Voicemail">Voicemail</option>
              <option value="In Progress">In Progress</option>
            </select>
            <select
              value={directionFilter}
              onChange={(event) => setDirectionFilter(event.target.value as CallDirection | 'All')}
              className="form-input"
              aria-label="Call direction"
            >
              <option value="All">All directions</option>
              <option value="Incoming">Incoming</option>
              <option value="Outgoing">Outgoing</option>
            </select>
            <select
              value={outcomeFilter}
              onChange={(event) => setOutcomeFilter(event.target.value as CallOutcome | 'All')}
              className="form-input"
              aria-label="Call outcome"
            >
              <option value="All">All outcomes</option>
              <option value="Qualified">Qualified</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Wrong Number">Wrong Number</option>
              <option value="Converted">Converted</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Call History</h2>
              <p className="card-subtitle">{filteredRecords.length} records in the current view</p>
            </div>
            <Filter className="h-5 w-5 text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[980px]">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Direction</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Agent</th>
                  <th>Outcome</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className={record.id === selectedRecord?.id ? 'bg-blue-50' : ''}
                    onClick={() => {
                      setSelectedId(record.id);
                      setIsPlaying(false);
                    }}
                  >
                    <td>
                      <div>
                        <p className="font-bold text-gray-900">{record.customerName}</p>
                        <p className="text-xs text-gray-500">{record.phone}</p>
                      </div>
                    </td>
                    <td>
                      <span className={directionClass(record.direction)}>{record.direction}</span>
                    </td>
                    <td>
                      <span className={statusClass(record.status)}>{record.status}</span>
                    </td>
                    <td>{formatDuration(record.durationSeconds)}</td>
                    <td>{record.agent}</td>
                    <td>
                      <span className={outcomeClass(record.outcome)}>{record.outcome}</span>
                    </td>
                    <td>{new Date(record.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRecords.length === 0 && (
            <div className="py-12 text-center">
              <Mic className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <h3 className="text-lg font-extrabold text-gray-900">No synced call history yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                Real call records, recordings, durations, and dispositions will appear here after the phone service
                exposes a call-history endpoint.
              </p>
            </div>
          )}
        </div>

        {selectedRecord && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Call Details</h2>
                <p className="card-subtitle">{selectedRecord.id}</p>
              </div>
              <span className={statusClass(selectedRecord.status)}>{selectedRecord.status}</span>
            </div>
            <div className="card-body space-y-5">
              <div className="flex items-start gap-3">
                <span className="avatar">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-gray-900">{selectedRecord.customerName}</p>
                  <p className="text-sm text-gray-500">{selectedRecord.email}</p>
                  <p className="text-sm font-semibold text-gray-700">{selectedRecord.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Assigned Agent</p>
                  <p className="mt-1 font-bold text-gray-900">{selectedRecord.agent}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Duration</p>
                  <p className="mt-1 font-bold text-gray-900">{formatDuration(selectedRecord.durationSeconds)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Disposition</p>
                  <p className="mt-1 font-bold text-gray-900">{selectedRecord.disposition}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Queue</p>
                  <p className="mt-1 font-bold text-gray-900">{selectedRecord.queue}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Mic className="h-4 w-4" />
                  Recording Playback
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setIsPlaying((current) => !current)}
                      disabled={!selectedRecord.recordingUrl}
                      title={selectedRecord.recordingUrl ? 'Toggle playback' : 'Recording unavailable'}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <div className="flex-1">
                      <div className="progress-bar">
                        <div
                          className="progress-bar__fill text-blue-600"
                          style={{ width: selectedRecord.recordingUrl ? (isPlaying ? '62%' : '28%') : '0%' }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {selectedRecord.recordingUrl ? 'Recording metadata ready' : 'No recording attached'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                  <FileText className="h-4 w-4" />
                  Notes
                </p>
                <p className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
                  {selectedRecord.notes}
                </p>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Tag className="h-4 w-4" />
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedRecord.tags.map((tag) => (
                    <span key={tag} className="status-pill status-pill--slate">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {selectedRecord.followUpAt && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                    <CalendarClock className="h-4 w-4" />
                    Follow-up
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    {new Date(selectedRecord.followUpAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Call Timeline</h2>
              <p className="card-subtitle">Enterprise call workflow events</p>
            </div>
          </div>
          <div className="card-body">
            <div className="timeline">
              <div className="timeline-item">
                <span className="timeline-dot">
                  <PhoneCall className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-bold text-gray-900">Call started</p>
                  <p className="text-sm text-gray-500">{new Date(selectedRecord.startedAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot">
                  <Headphones className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-bold text-gray-900">Assigned to {selectedRecord.agent}</p>
                  <p className="text-sm text-gray-500">{selectedRecord.queue} queue</p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-bold text-gray-900">Disposition recorded</p>
                  <p className="text-sm text-gray-500">
                    {selectedRecord.disposition} - {selectedRecord.outcome}
                  </p>
                </div>
              </div>
              {selectedRecord.followUpAt && (
                <div className="timeline-item">
                  <span className="timeline-dot">
                    <CalendarClock className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-gray-900">Follow-up scheduled</p>
                    <p className="text-sm text-gray-500">{new Date(selectedRecord.followUpAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calls;
