import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Video,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leadApi, userApi, zoomMeetingsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { CreateZoomMeetingForm, Lead, User, ZoomMeeting, ZoomMeetingsStatus } from '../types';

const toDateTimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const defaultMeetingForm = (): CreateZoomMeetingForm => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  return {
    topic: '',
    agenda: '',
    startTime: toDateTimeLocal(start),
    duration: 30,
    timezone: 'Europe/London',
    leadId: '',
    hostUserId: '',
    hostZoomUserId: '',
    joinBeforeHost: false,
    waitingRoom: true,
    autoRecording: 'none'
  };
};

const formatMeetingTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ZoomMeetings: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ZoomMeetingsStatus | null>(null);
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<ZoomMeeting | null>(null);
  const [formData, setFormData] = useState<CreateZoomMeetingForm>(defaultMeetingForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState('');

  const isAdmin = user?.role === 'admin';

  const fetchWorkspaceData = async () => {
    setLoading(true);
    const [statusResponse, meetingsResponse, leadsResponse, usersResponse] = await Promise.all([
      zoomMeetingsApi.getStatus(),
      zoomMeetingsApi.getMeetings({ search: searchQuery, status: statusFilter }),
      isAdmin ? leadApi.getLeads(undefined, 1, 100) : leadApi.getMyLeads(1, 100),
      isAdmin ? userApi.getAllUsers() : Promise.resolve({ success: true, data: [] as User[] })
    ]);

    if (statusResponse.success && statusResponse.data) setStatus(statusResponse.data);
    if (meetingsResponse.success && meetingsResponse.data) {
      setMeetings(meetingsResponse.data);
      setSelectedMeeting((current) => current || meetingsResponse.data?.[0] || null);
    } else {
      toast.error(meetingsResponse.message || 'Failed to load Zoom meetings');
    }
    if (leadsResponse.success && leadsResponse.data) setLeads(leadsResponse.data);
    if (usersResponse.success && usersResponse.data) setUsers(usersResponse.data.filter((item) => item.isActive));

    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMeetings = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return meetings.filter((meeting) => {
      const matchesSearch =
        !normalized ||
        meeting.topic.toLowerCase().includes(normalized) ||
        meeting.zoomMeetingId.includes(normalized) ||
        meeting.lead?.name?.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === 'all' || meeting.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [meetings, searchQuery, statusFilter]);

  const handleCreateMeeting = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.topic.trim()) {
      toast.error('Meeting topic is required');
      return;
    }

    const startDate = new Date(formData.startTime);
    if (Number.isNaN(startDate.getTime())) {
      toast.error('Please choose a valid start time');
      return;
    }

    setSaving(true);
    const payload: CreateZoomMeetingForm = {
      ...formData,
      topic: formData.topic.trim(),
      agenda: formData.agenda?.trim() || undefined,
      startTime: startDate.toISOString(),
      duration: Number(formData.duration || 30),
      leadId: formData.leadId || undefined,
      hostUserId: formData.hostUserId || undefined,
      hostZoomUserId: formData.hostZoomUserId?.trim() || undefined
    };

    const response = await zoomMeetingsApi.createMeeting(payload);
    if (response.success && response.data) {
      toast.success('Zoom meeting created');
      setMeetings((current) => [response.data as ZoomMeeting, ...current]);
      setSelectedMeeting(response.data);
      setFormData(defaultMeetingForm());
    } else {
      toast.error(response.message || 'Failed to create Zoom meeting');
    }
    setSaving(false);
  };

  const syncMeetingDetails = async (meeting: ZoomMeeting) => {
    setSyncingId(meeting._id);
    const response = await zoomMeetingsApi.getMeeting(meeting._id);
    if (response.success && response.data) {
      setMeetings((current) => current.map((item) => (item._id === response.data?._id ? response.data : item)));
      setSelectedMeeting(response.data);
      toast.success('Meeting details refreshed');
    } else {
      toast.error(response.message || 'Failed to refresh meeting');
    }
    setSyncingId('');
  };

  const cancelMeeting = async (meeting: ZoomMeeting) => {
    if (!window.confirm(`Cancel Zoom meeting "${meeting.topic}"?`)) return;

    setSyncingId(meeting._id);
    const response = await zoomMeetingsApi.cancelMeeting(meeting._id);
    if (response.success && response.data) {
      setMeetings((current) => current.map((item) => (item._id === response.data?._id ? response.data : item)));
      setSelectedMeeting(response.data);
      toast.success('Meeting cancelled');
    } else {
      toast.error(response.message || 'Failed to cancel meeting');
    }
    setSyncingId('');
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-blue-600">
            <Video className="h-4 w-4" />
            Zoom Meetings
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950">Meeting Center</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Create, track, and join Zoom meetings from the CRM while preserving meeting IDs and links for follow-up.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchWorkspaceData} disabled={loading}>
          {loading ? <div className="loading-spinner" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {status && !status.configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5" />
            <div>
              <strong>Zoom Meetings is waiting for backend credentials.</strong>
              <p className="mt-1">
                Configure the Zoom Server-to-Server OAuth environment variables, then refresh this page.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleCreateMeeting} className="card h-fit">
          <div className="card-header">
            <div>
              <h2 className="card-title">Create Meeting</h2>
              <p className="card-subtitle">Schedule through Zoom API</p>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div className="form-group">
              <label className="form-label">Topic</label>
              <input
                className="form-input"
                value={formData.topic}
                onChange={(event) => setFormData((current) => ({ ...current, topic: event.target.value }))}
                placeholder="Strategy call with prospect"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={formData.startTime}
                  onChange={(event) => setFormData((current) => ({ ...current, startTime: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  className="form-input"
                  value={formData.duration}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, duration: Number(event.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Lead</label>
              <select
                className="form-input"
                value={formData.leadId}
                onChange={(event) => setFormData((current) => ({ ...current, leadId: event.target.value }))}
              >
                <option value="">No lead linked</option>
                {leads.map((lead) => (
                  <option key={lead._id} value={lead._id}>
                    {lead.name} - {lead.phone}
                  </option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div className="form-group">
                <label className="form-label">CRM Host</label>
                <select
                  className="form-input"
                  value={formData.hostUserId}
                  onChange={(event) => setFormData((current) => ({ ...current, hostUserId: event.target.value }))}
                >
                  <option value="">Default host</option>
                  {users.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} - {item.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Zoom Host User ID or Email</label>
              <input
                className="form-input"
                value={formData.hostZoomUserId}
                onChange={(event) => setFormData((current) => ({ ...current, hostZoomUserId: event.target.value }))}
                placeholder={status?.defaultHostUserId || 'me'}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Agenda</label>
              <textarea
                rows={4}
                className="form-input"
                value={formData.agenda}
                onChange={(event) => setFormData((current) => ({ ...current, agenda: event.target.value }))}
                placeholder="Meeting notes, customer context, or agenda"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(formData.waitingRoom)}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, waitingRoom: event.target.checked }))
                  }
                />
                Waiting room
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(formData.joinBeforeHost)}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, joinBeforeHost: event.target.checked }))
                  }
                />
                Join before host
              </label>
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={saving || !status?.configured}>
              {saving ? <div className="loading-spinner" /> : <Plus className="h-4 w-4" />}
              Create Zoom Meeting
            </button>
          </div>
        </form>

        <div className="space-y-5">
          <div className="card">
            <div className="card-body">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    className="form-input pl-10"
                    placeholder="Search topic, lead, or meeting ID"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <select
                  className="form-input"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="synced">Synced</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_380px]">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Scheduled Meetings</h2>
                  <p className="card-subtitle">{filteredMeetings.length} records in current view</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="space-y-3 p-4">
                    <div className="skeleton h-20" />
                    <div className="skeleton h-20" />
                  </div>
                ) : filteredMeetings.length > 0 ? (
                  filteredMeetings.map((meeting) => (
                    <button
                      key={meeting._id}
                      type="button"
                      className={`w-full p-4 text-left transition hover:bg-slate-50 ${
                        selectedMeeting?._id === meeting._id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedMeeting(meeting)}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="status-pill status-pill--blue">{meeting.status}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                              ID {meeting.zoomMeetingId}
                            </span>
                          </div>
                          <h3 className="mt-2 text-base font-extrabold text-slate-950">{meeting.topic}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {meeting.lead?.name || 'No lead'} · {meeting.duration} min
                          </p>
                        </div>
                        <div className="text-sm text-slate-500 lg:text-right">
                          <p>{formatMeetingTime(meeting.startTime)}</p>
                          <p>{meeting.timezone}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="lead-empty-state">
                    <Video className="h-10 w-10" />
                    <h3>No meetings found</h3>
                    <p>Create your first Zoom meeting from the CRM form.</p>
                  </div>
                )}
              </div>
            </div>

            <aside className="card h-fit">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Meeting Details</h2>
                  <p className="card-subtitle">Join links and Zoom metadata</p>
                </div>
              </div>
              <div className="card-body">
                {selectedMeeting ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-950">{selectedMeeting.topic}</h3>
                      <p className="mt-1 text-sm text-slate-500">{selectedMeeting.agenda || 'No agenda added'}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="lead-summary-row">
                        <span>Start</span>
                        <strong>{formatMeetingTime(selectedMeeting.startTime)}</strong>
                      </div>
                      <div className="lead-summary-row">
                        <span>Meeting ID</span>
                        <strong>{selectedMeeting.zoomMeetingId}</strong>
                      </div>
                      <div className="lead-summary-row">
                        <span>Passcode</span>
                        <strong>{selectedMeeting.password || 'Not provided'}</strong>
                      </div>
                      <div className="lead-summary-row">
                        <span>Lead</span>
                        <strong>{selectedMeeting.lead?.name || 'Not linked'}</strong>
                      </div>
                      <div className="lead-summary-row">
                        <span>Host</span>
                        <strong>{selectedMeeting.hostUser?.name || selectedMeeting.createdBy?.name || 'Default Zoom host'}</strong>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <a
                        href={selectedMeeting.joinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Join Meeting
                      </a>
                      {selectedMeeting.startUrl && (
                        <a
                          href={selectedMeeting.startUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                        >
                          <LinkIcon className="h-4 w-4" />
                          Start as Host
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => syncMeetingDetails(selectedMeeting)}
                        disabled={syncingId === selectedMeeting._id}
                      >
                        {syncingId === selectedMeeting._id ? <div className="loading-spinner" /> : <RefreshCw className="h-4 w-4" />}
                        Sync Details
                      </button>
                      {selectedMeeting.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn btn-secondary text-rose-700"
                          onClick={() => cancelMeeting(selectedMeeting)}
                          disabled={syncingId === selectedMeeting._id}
                        >
                          <Trash2 className="h-4 w-4" />
                          Cancel Meeting
                        </button>
                      )}
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <Users className="h-4 w-4" />
                        Future-ready
                      </div>
                      <p className="mt-1">
                        This record keeps Zoom IDs and raw metadata so recordings, webinars, and participant reports can plug in later.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="lead-empty-state">
                    <Calendar className="h-10 w-10" />
                    <h3>Select a meeting</h3>
                    <p>Meeting links and details will appear here.</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoomMeetings;
