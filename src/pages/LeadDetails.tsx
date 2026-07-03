import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadApi, userApi, zoomPhoneApi } from '../lib/api';
import type {
  Lead,
  LeadPriority,
  LeadSource,
  LeadStatus,
  User as AppUser,
  ZoomPhoneCallLog,
  ZoomPhoneRecording,
  ZoomPhoneStatus
} from '../types';
import LeadWhatsAppButton from '../components/LeadWhatsAppButton';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Edit,
  FileText,
  Headphones,
  Mail,
  MessageSquare,
  Phone,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  UserPlus,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { reminderApi } from '../lib/reminderApi';

type LeadDetailTab = 'activity' | 'calls' | 'notes' | 'tasks';

interface ReturnState {
  returnTo?: string;
  currentPage?: number;
  leadsPerPage?: number;
  searchQuery?: string;
  currentView?: string;
  selectedFolder?: string;
  statusFilter?: string;
  folderFilter?: string;
  filters?: {
    status?: string[];
    source?: string[];
    priority?: string[];
  };
}

const statusOptions: LeadStatus[] = [
  'New',
  'Contacted',
  'Follow-up',
  'Interested',
  'Qualified',
  'Proposal Sent',
  'Negotiating',
  'Sales Done',
  'DNP',
  'Not Interested',
  'Wrong Number',
  'Call Back'
];

const priorityOptions: LeadPriority[] = ['High', 'Medium', 'Low'];

const sourceOptions: LeadSource[] = [
  'Website',
  'Social Media',
  'Referral',
  'Import',
  'Manual',
  'Cold Call',
  'Email Campaign',
  'strategy_call_modal',
  'data_analytics_landing_page'
];

const formatSource = (source: string) =>
  source
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const statusTone = (status: LeadStatus) => {
  const normalized = status.toLowerCase();
  if (['sales done', 'qualified', 'interested'].includes(normalized)) return 'status-pill status-pill--green';
  if (['follow-up', 'call back', 'contacted'].includes(normalized)) return 'status-pill status-pill--amber';
  if (['not interested', 'wrong number', 'dnp'].includes(normalized)) return 'status-pill status-pill--rose';
  return 'status-pill status-pill--blue';
};

const priorityTone = (priority: LeadPriority) => {
  if (priority === 'High') return 'text-rose-600 bg-rose-50 border-rose-200';
  if (priority === 'Medium') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-green-700 bg-green-50 border-green-200';
};

const formatCallDate = (value?: string) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const callLogId = (call: ZoomPhoneCallLog) => call.id || call.call_id || '';

const recordingId = (recording: ZoomPhoneRecording) => recording.id || recording.call_id || recording.call_log_id || '';

const defaultCallDateRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
};

const LeadDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<LeadDetailTab>('activity');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [callDateRange, setCallDateRange] = useState(defaultCallDateRange);
  const [zoomStatus, setZoomStatus] = useState<ZoomPhoneStatus | null>(null);
  const [zoomCalls, setZoomCalls] = useState<ZoomPhoneCallLog[]>([]);
  const [zoomRecordings, setZoomRecordings] = useState<ZoomPhoneRecording[]>([]);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomError, setZoomError] = useState('');
  const [callRecordings, setCallRecordings] = useState<Record<string, ZoomPhoneRecording[]>>({});
  const [recordingsLoading, setRecordingsLoading] = useState<Record<string, boolean>>({});
  const [audioUrl, setAudioUrl] = useState('');
  const [activeRecordingId, setActiveRecordingId] = useState('');
  const [audioLoadingId, setAudioLoadingId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    zoomPhoneNumber: '',
    position: '',
    folder: '',
    status: 'New' as LeadStatus,
    priority: 'Medium' as LeadPriority,
    source: 'Manual' as LeadSource
  });

  const canManage = user?.role === 'admin';
  const canEdit = canManage || lead?.assignedTo === user?._id;

  const syncLeadState = (nextLead: Lead) => {
    setLead(nextLead);
    setSelectedAssignee(nextLead.assignedToUser?._id || nextLead.assignedTo || '');
    setFormData({
      name: nextLead.name || '',
      email: nextLead.email || '',
      phone: nextLead.phone || '',
      whatsapp: nextLead.whatsapp || '',
      zoomPhoneNumber: nextLead.zoomPhoneNumber || '',
      position: nextLead.position || '',
      folder: nextLead.folder || '',
      status: nextLead.status || 'New',
      priority: nextLead.priority || 'Medium',
      source: nextLead.source || 'Manual'
    });
  };

  const fetchLead = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    const response = await leadApi.getLead(id);

    if (response.success && response.data) {
      syncLeadState(response.data);
    } else {
      toast.error(response.message || 'Failed to fetch lead details');
      navigate('/leads');
    }

    setLoading(false);
  }, [id, navigate]);

  const fetchUsers = useCallback(async () => {
    if (!canManage) return;
    const response = await userApi.getAllUsers();

    if (response.success && response.data) {
      setUsers(response.data.filter((item) => item.isActive));
    }
  }, [canManage]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const sortedNotes = useMemo(
    () =>
      [...(lead?.notes || [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [lead?.notes]
  );

  const leadPhoneNumbers = useMemo(
    () => [lead?.phone, lead?.whatsapp, lead?.zoomPhoneNumber].filter(Boolean) as string[],
    [lead?.phone, lead?.whatsapp, lead?.zoomPhoneNumber]
  );

  const fetchZoomPhoneData = useCallback(async () => {
    if (!lead?._id) return;

    setZoomLoading(true);
    setZoomError('');

    const statusResponse = await zoomPhoneApi.getStatus();

    if (!statusResponse.success || !statusResponse.data) {
      setZoomError(statusResponse.message || 'Unable to check Zoom Phone configuration');
      setZoomLoading(false);
      return;
    }

    setZoomStatus(statusResponse.data);

    if (!statusResponse.data.configured) {
      setZoomCalls([]);
      setZoomRecordings([]);
      setZoomError('Zoom Phone API credentials are not configured on the backend yet.');
      setZoomLoading(false);
      return;
    }

    const query = {
      from: callDateRange.from,
      to: callDateRange.to,
      pageSize: 300
    };

    const [callsResponse, recordingsResponse] = await Promise.all([
      zoomPhoneApi.getLeadCalls(lead._id, query),
      zoomPhoneApi.getLeadRecordings(lead._id, query)
    ]);

    if (callsResponse.success && callsResponse.data) {
      setZoomCalls(callsResponse.data.call_logs || []);
    } else {
      setZoomCalls([]);
      setZoomError(callsResponse.message || 'Unable to sync Zoom Phone call history');
    }

    if (recordingsResponse.success && recordingsResponse.data) {
      setZoomRecordings(recordingsResponse.data.recordings || []);
    } else {
      setZoomRecordings([]);
      setZoomError((current) => current || recordingsResponse.message || 'Unable to sync Zoom Phone recordings');
    }

    setZoomLoading(false);
  }, [callDateRange.from, callDateRange.to, lead?._id]);

  useEffect(() => {
    if (activeTab === 'calls') {
      fetchZoomPhoneData();
    }
  }, [activeTab, fetchZoomPhoneData]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const loadCallRecordings = async (call: ZoomPhoneCallLog) => {
    if (!lead) return;
    const idForCall = callLogId(call);

    if (!idForCall) {
      toast.error('This Zoom call log does not include a recording lookup ID');
      return;
    }

    setRecordingsLoading((current) => ({ ...current, [idForCall]: true }));
    const response = await zoomPhoneApi.getCallLogRecordings(lead._id, idForCall);

    if (response.success && response.data) {
      setCallRecordings((current) => ({
        ...current,
        [idForCall]: response.data?.recordings || []
      }));
    } else {
      toast.error(response.message || 'Failed to load recordings for this call');
    }

    setRecordingsLoading((current) => ({ ...current, [idForCall]: false }));
  };

  const getRecordingAudioOptions = (recording: ZoomPhoneRecording) => {
    const options: { downloadUrl?: string; callLogId?: string; from?: string; to?: string } = {
      from: callDateRange.from,
      to: callDateRange.to
    };
    const downloadUrl = recording.download_url || recording.file_url;

    if (downloadUrl) options.downloadUrl = downloadUrl;
    if (recording.call_log_id) options.callLogId = recording.call_log_id;

    return options;
  };

  const playRecording = async (recording: ZoomPhoneRecording) => {
    if (!lead) return;
    const idForRecording = recordingId(recording);

    if (!idForRecording) {
      toast.error('This Zoom recording is missing a playback ID');
      return;
    }

    setAudioLoadingId(idForRecording);

    try {
      const blob = await zoomPhoneApi.downloadLeadRecordingAudio(
        lead._id,
        idForRecording,
        getRecordingAudioOptions(recording)
      );
      const nextAudioUrl = URL.createObjectURL(blob);
      setAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextAudioUrl;
      });
      setActiveRecordingId(idForRecording);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to play Zoom recording');
    } finally {
      setAudioLoadingId('');
    }
  };

  const downloadRecording = async (recording: ZoomPhoneRecording) => {
    if (!lead) return;
    const idForRecording = recordingId(recording);

    if (!idForRecording) {
      toast.error('This Zoom recording is missing a download ID');
      return;
    }

    setAudioLoadingId(idForRecording);

    try {
      const blob = await zoomPhoneApi.downloadLeadRecordingAudio(
        lead._id,
        idForRecording,
        getRecordingAudioOptions(recording)
      );
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${lead.name.replace(/\s+/g, '-').toLowerCase()}-${idForRecording}.mp3`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download Zoom recording');
    } finally {
      setAudioLoadingId('');
    }
  };

  const handleGoBack = () => {
    const state = location.state as ReturnState | null;

    if (state?.returnTo) {
      const params = new URLSearchParams();

      if (state.currentPage && state.currentPage > 1) params.set('page', state.currentPage.toString());
      if (state.leadsPerPage && state.leadsPerPage !== 10) params.set('size', state.leadsPerPage.toString());
      if (state.searchQuery) params.set('search', state.searchQuery);
      if (state.currentView === 'leads' && state.selectedFolder) params.set('folder', state.selectedFolder);
      if (state.statusFilter) params.set('status', state.statusFilter);
      if (state.folderFilter) params.set('folderFilter', state.folderFilter);
      if (state.filters?.status?.length) params.set('statusFilter', state.filters.status.join(','));
      if (state.filters?.source?.length) params.set('sourceFilter', state.filters.source.join(','));
      if (state.filters?.priority?.length) params.set('priorityFilter', state.filters.priority.join(','));

      const queryString = params.toString();
      navigate(queryString ? `${state.returnTo}?${queryString}` : state.returnTo, { replace: true });
      return;
    }

    navigate('/leads');
  };

  const handleSave = async () => {
    if (!id) return;

    setSaving(true);
    const response = await leadApi.updateLead(id, formData);

    if (response.success && response.data) {
      syncLeadState(response.data);
      setIsEditing(false);
      toast.success('Lead updated successfully');
    } else {
      toast.error(response.message || 'Failed to update lead');
    }

    setSaving(false);
  };

  const handleAssignLead = async () => {
    if (!lead || !selectedAssignee) {
      toast.error('Please select an employee');
      return;
    }

    setAssigning(true);
    const response = await leadApi.assignLeads({
      leadIds: [lead._id],
      assignToUserId: selectedAssignee
    });

    if (response.success) {
      toast.success('Lead assigned successfully');
      await fetchLead();
    } else {
      toast.error(response.message || 'Failed to assign lead');
    }

    setAssigning(false);
  };

  const handleUnassignLead = async () => {
    if (!lead) return;

    setAssigning(true);
    const response = await leadApi.unassignLeads({ leadIds: [lead._id] });

    if (response.success) {
      toast.success('Lead unassigned successfully');
      setSelectedAssignee('');
      await fetchLead();
    } else {
      toast.error(response.message || 'Failed to unassign lead');
    }

    setAssigning(false);
  };

  const handleAddNote = async () => {
    if (!lead || !newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setAddingNote(true);
    const response = await leadApi.addNote({
      leadId: lead._id,
      content: newNote.trim()
    });

    if (response.success && response.data) {
      syncLeadState(response.data);
      setNewNote('');
      toast.success('Note added successfully');
    } else {
      toast.error(response.message || 'Failed to add note');
    }

    setAddingNote(false);
  };

  const createReminder = async () => {
    if (!lead || !reminderTitle.trim() || !remindAt) {
      toast.error('Please enter title and reminder time');
      return;
    }

    const response = await reminderApi.createReminder({
      leadId: lead._id,
      title: reminderTitle.trim(),
      note: reminderNote.trim(),
      remindAt
    });

    if (response.success) {
      setShowReminderForm(false);
      setReminderTitle('');
      setReminderNote('');
      setRemindAt('');
      toast.success('Reminder set');
    } else {
      toast.error(response.message || 'Failed to set reminder');
    }
  };

  if (loading) {
    return (
      <div className="page-stack">
        <div className="skeleton h-10 w-72" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr_360px]">
          <div className="skeleton h-[560px]" />
          <div className="skeleton h-[560px]" />
          <div className="skeleton h-[560px]" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="card mx-auto max-w-lg">
        <div className="card-body text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h1 className="text-xl font-extrabold text-gray-900">Lead not found</h1>
          <p className="mt-2 text-gray-500">The lead does not exist or you do not have access.</p>
          <button type="button" onClick={handleGoBack} className="btn btn-primary mt-5">
            Back to leads
          </button>
        </div>
      </div>
    );
  }

  const ownerName = lead.assignedToUser?.name || 'Unassigned';

  return (
    <div className="lead-detail-page">
      <div className="lead-detail-topbar">
        <button type="button" className="btn btn-secondary" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </button>
        <div className="lead-detail-topbar__actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowReminderForm(true)}>
            <Clock className="h-4 w-4" />
            Set Reminder
          </button>
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={saving}>
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <div className="loading-spinner" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4" />
                  Edit Lead
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="lead-detail-grid">
        <aside className="lead-profile-panel">
          <div className="lead-profile-panel__avatar">{lead.name.charAt(0).toUpperCase()}</div>
          <h1 className="lead-profile-panel__name">{lead.name}</h1>
          <p className="lead-profile-panel__role">{lead.position || 'Lead'}</p>

          <div className="lead-profile-panel__actions">
            <a href={`mailto:${lead.email}`} className="icon-button" title="Email lead">
              <Mail className="h-4 w-4" />
            </a>
            <a href={`tel:${lead.phone}`} className="icon-button" title="Call lead">
              <Phone className="h-4 w-4" />
            </a>
            <LeadWhatsAppButton lead={lead} className="icon-button" />
          </div>

          <div className="lead-profile-panel__section">
            <div className="lead-field">
              <span>Email</span>
              <a href={`mailto:${lead.email}`}>{lead.email || 'Not available'}</a>
            </div>
            <div className="lead-field">
              <span>Phone</span>
              <a href={`tel:${lead.phone}`}>{lead.phone || 'Not available'}</a>
            </div>
            <div className="lead-field">
              <span>WhatsApp</span>
              <span>{lead.whatsapp || lead.phone || 'Not available'}</span>
            </div>
            <div className="lead-field">
              <span>Zoom Phone</span>
              <span>{lead.zoomPhoneNumber || lead.phone || 'Not linked'}</span>
            </div>
            <div className="lead-field">
              <span>Folder</span>
              <span>{lead.folder || 'Uncategorized'}</span>
            </div>
          </div>

          <div className="lead-profile-panel__tabs">
            <button type="button" className="active">Lead Profile</button>
            <button type="button">Company</button>
          </div>

          <div className="lead-profile-panel__section">
            <div className="lead-field">
              <span>Created</span>
              <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="lead-field">
              <span>Last updated</span>
              <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="lead-field">
              <span>Source</span>
              <span>{formatSource(lead.source)}</span>
            </div>
          </div>
        </aside>

        <main className="lead-workspace-panel">
          <div className="lead-tabs" role="tablist" aria-label="Lead detail sections">
            {[
              ['activity', 'Activity'],
              ['calls', 'Calls'],
              ['notes', 'Notes'],
              ['tasks', 'Tasks']
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? 'active' : ''}
                onClick={() => setActiveTab(tab as LeadDetailTab)}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="lead-workspace-panel__body">
            {activeTab === 'activity' && (
              <div className="lead-activity-stack">
                <div>
                  <h2>Upcoming activity</h2>
                  <div className="lead-activity-item">
                    <span className="timeline-dot">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="lead-activity-item__content">
                      <div className="lead-activity-item__header">
                        <div>
                          <h3>Phone follow-up</h3>
                          <p>Owner: {ownerName}</p>
                        </div>
                        <span className={statusTone(lead.status)}>{lead.status}</span>
                      </div>
                      <p className="lead-activity-note">
                        Review lead details, call the prospect, then update disposition and notes.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h2>Activity history</h2>
                  {sortedNotes.length > 0 ? (
                    sortedNotes.map((note) => (
                      <div key={note.id} className="lead-activity-item">
                        <span className="timeline-dot">
                          <MessageSquare className="h-4 w-4" />
                        </span>
                        <div className="lead-activity-item__content">
                          <div className="lead-activity-item__header">
                            <div>
                              <h3>{note.createdBy?.name || 'Team member'} added a note</h3>
                              <p>{new Date(note.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                          <p className="lead-activity-note">{note.content}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="lead-empty-state">
                      <MessageSquare className="h-10 w-10" />
                      <h3>No activity recorded yet</h3>
                      <p>Add a note after calls, WhatsApp messages, or follow-ups.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'calls' && (
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-blue-600">
                        <Headphones className="h-4 w-4" />
                        Zoom Phone
                      </div>
                      <h2 className="mt-1 text-xl font-extrabold text-slate-950">Call recordings and history</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Matching calls for {leadPhoneNumbers.length > 0 ? leadPhoneNumbers.join(', ') : 'this lead'}.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="form-group">
                        <label className="form-label">From</label>
                        <input
                          type="date"
                          className="form-input"
                          value={callDateRange.from}
                          onChange={(event) =>
                            setCallDateRange((current) => ({ ...current, from: event.target.value }))
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">To</label>
                        <input
                          type="date"
                          className="form-input"
                          value={callDateRange.to}
                          onChange={(event) =>
                            setCallDateRange((current) => ({ ...current, to: event.target.value }))
                          }
                        />
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={fetchZoomPhoneData} disabled={zoomLoading}>
                        {zoomLoading ? <div className="loading-spinner" /> : <RefreshCw className="h-4 w-4" />}
                        Sync
                      </button>
                    </div>
                  </div>

                  {zoomStatus && !zoomStatus.configured && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Zoom Phone credentials are not configured on the backend. Add the Zoom Server-to-Server OAuth
                      environment variables, then sync again.
                    </div>
                  )}

                  {zoomError && zoomStatus?.configured && (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {zoomError}
                    </div>
                  )}
                </div>

                {activeRecordingId && audioUrl && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-800">
                      <PlayCircle className="h-4 w-4" />
                      Playing recording {activeRecordingId}
                    </div>
                    <audio className="w-full" controls autoPlay src={audioUrl}>
                      <track kind="captions" />
                    </audio>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_420px]">
                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-4">
                      <h3 className="text-lg font-extrabold text-slate-950">Call History</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {zoomLoading ? 'Syncing Zoom Phone calls...' : `${zoomCalls.length} matched call records`}
                      </p>
                    </div>

                    {zoomLoading ? (
                      <div className="space-y-3 p-4">
                        <div className="skeleton h-20" />
                        <div className="skeleton h-20" />
                        <div className="skeleton h-20" />
                      </div>
                    ) : zoomCalls.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {zoomCalls.map((call, index) => {
                          const idForCall = callLogId(call) || `${call.date_time || 'call'}-${index}`;
                          const nestedRecordings = callRecordings[idForCall] || [];
                          const hasRecordingHint = Boolean(call.recording_id || call.recording_type);

                          return (
                            <div key={idForCall} className="p-4">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={statusTone(call.result || 'New')}>{call.result || 'Unknown'}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                                      {call.direction || call.call_type || 'Call'}
                                    </span>
                                    {hasRecordingHint && (
                                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
                                        Recording ready
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="mt-3 text-base font-extrabold text-slate-950">
                                    {call.caller_name || call.caller_number || 'Unknown caller'} to{' '}
                                    {call.callee_name || call.callee_number || 'Unknown recipient'}
                                  </h4>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {formatCallDate(call.date_time || call.answer_start_time)} · {formatDuration(call.duration)}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    Owner: {call.owner?.name || ownerName}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <a href={`tel:${lead.phone}`} className="btn btn-secondary">
                                    <Phone className="h-4 w-4" />
                                    Call
                                  </a>
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => loadCallRecordings(call)}
                                    disabled={recordingsLoading[idForCall]}
                                  >
                                    {recordingsLoading[idForCall] ? (
                                      <div className="loading-spinner" />
                                    ) : (
                                      <Headphones className="h-4 w-4" />
                                    )}
                                    Recordings
                                  </button>
                                </div>
                              </div>

                              {nestedRecordings.length > 0 && (
                                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                  {nestedRecordings.map((recording) => {
                                    const idForRecording = recordingId(recording);
                                    return (
                                      <div key={idForRecording} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="font-extrabold text-slate-900">
                                              {recording.recording_type || 'Call recording'}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                              {formatCallDate(recording.date_time)} · {formatDuration(recording.duration)}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            className="icon-button"
                                            title="Play recording"
                                            onClick={() => playRecording(recording)}
                                            disabled={audioLoadingId === idForRecording}
                                          >
                                            {audioLoadingId === idForRecording ? (
                                              <div className="loading-spinner" />
                                            ) : (
                                              <PlayCircle className="h-4 w-4" />
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="lead-empty-state">
                        <Phone className="h-10 w-10" />
                        <h3>No Zoom Phone calls matched</h3>
                        <p>Check the date range or add the lead's Zoom Phone number in the profile.</p>
                        <a href={`tel:${lead.phone}`} className="btn btn-primary">
                          <Phone className="h-4 w-4" />
                          Call Now
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-4">
                      <h3 className="text-lg font-extrabold text-slate-950">All Recordings</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {zoomRecordings.length} matched recordings for this lead
                      </p>
                    </div>

                    {zoomRecordings.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {zoomRecordings.map((recording, index) => {
                          const idForRecording = recordingId(recording) || `${recording.date_time || 'recording'}-${index}`;
                          return (
                            <div key={idForRecording} className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-950">
                                    {recording.caller_name || recording.caller_number || 'Unknown'} to{' '}
                                    {recording.callee_name || recording.callee_number || 'Unknown'}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {formatCallDate(recording.date_time)} · {formatDuration(recording.duration)}
                                  </p>
                                  <p className="mt-1 text-xs font-bold uppercase text-slate-400">
                                    {recording.recording_type || recording.direction || 'Recording'}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="icon-button"
                                    title="Play recording"
                                    onClick={() => playRecording(recording)}
                                    disabled={audioLoadingId === idForRecording}
                                  >
                                    {audioLoadingId === idForRecording ? (
                                      <div className="loading-spinner" />
                                    ) : (
                                      <PlayCircle className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    title="Download recording"
                                    onClick={() => downloadRecording(recording)}
                                    disabled={audioLoadingId === idForRecording}
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="lead-empty-state">
                        <Headphones className="h-10 w-10" />
                        <h3>No recordings found</h3>
                        <p>Recordings will appear after Zoom Phone returns a matched caller or callee number.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="lead-notes-panel">
                {canEdit && (
                  <div className="lead-note-composer">
                    <textarea
                      value={newNote}
                      onChange={(event) => setNewNote(event.target.value)}
                      placeholder="Add a note about this lead..."
                      className="form-input"
                      rows={4}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddNote}
                        disabled={addingNote || !newNote.trim()}
                      >
                        {addingNote ? <div className="loading-spinner" /> : <Plus className="h-4 w-4" />}
                        Add Note
                      </button>
                    </div>
                  </div>
                )}

                {sortedNotes.length > 0 ? (
                  sortedNotes.map((note) => (
                    <div key={note.id} className="lead-note-card">
                      <div className="lead-note-card__meta">
                        <strong>{note.createdBy?.name || 'Team member'}</strong>
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                      <p>{note.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="lead-empty-state">
                    <FileText className="h-10 w-10" />
                    <h3>No notes yet</h3>
                    <p>Use notes to track customer context, outcomes, and next steps.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="lead-empty-state">
                <Calendar className="h-10 w-10" />
                <h3>No open tasks</h3>
                <p>Create a reminder for the next call, meeting, or follow-up.</p>
                <button type="button" className="btn btn-primary" onClick={() => setShowReminderForm(true)}>
                  <Plus className="h-4 w-4" />
                  Create Reminder
                </button>
              </div>
            )}
          </section>
        </main>

        <aside className="lead-side-panel">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Lead Status</h2>
                <p className="card-subtitle">Pipeline and priority</p>
              </div>
            </div>
            <div className="card-body space-y-4">
              {isEditing ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={formData.status}
                      onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-input"
                      value={formData.priority}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, priority: event.target.value as LeadPriority }))
                      }
                    >
                      {priorityOptions.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="lead-summary-row">
                    <span>Status</span>
                    <span className={statusTone(lead.status)}>{lead.status}</span>
                  </div>
                  <div className="lead-summary-row">
                    <span>Priority</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${priorityTone(lead.priority)}`}>
                      {lead.priority}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Assignment</h2>
                <p className="card-subtitle">Owner and handoff</p>
              </div>
            </div>
            <div className="card-body space-y-4">
              <div className="lead-owner-card">
                <span className="avatar">{ownerName.charAt(0).toUpperCase()}</span>
                <div>
                  <p>{ownerName}</p>
                  <span>{lead.assignedToUser?.email || 'No employee assigned'}</span>
                </div>
              </div>

              {canManage && (
                <div className="space-y-3">
                  <label className="form-label">Assign Lead</label>
                  <select
                    className="form-input"
                    value={selectedAssignee}
                    onChange={(event) => setSelectedAssignee(event.target.value)}
                  >
                    <option value="">Select employee</option>
                    {users.map((employee) => (
                      <option key={employee._id} value={employee._id}>
                        {employee.name} - {employee.email}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="btn btn-primary" onClick={handleAssignLead} disabled={assigning}>
                      {assigning ? <div className="loading-spinner" /> : <UserPlus className="h-4 w-4" />}
                      Assign
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleUnassignLead} disabled={assigning}>
                      Unassign
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Lead Information</h2>
                <p className="card-subtitle">Editable CRM fields</p>
              </div>
            </div>
            <div className="card-body">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      value={formData.phone}
                      onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp</label>
                    <input
                      className="form-input"
                      value={formData.whatsapp}
                      onChange={(event) => setFormData((current) => ({ ...current, whatsapp: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Zoom Phone Number</label>
                    <input
                      className="form-input"
                      value={formData.zoomPhoneNumber}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, zoomPhoneNumber: event.target.value }))
                      }
                      placeholder="Number used in Zoom Phone call logs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Position</label>
                    <input
                      className="form-input"
                      value={formData.position}
                      onChange={(event) => setFormData((current) => ({ ...current, position: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Folder</label>
                    <input
                      className="form-input"
                      value={formData.folder}
                      onChange={(event) => setFormData((current) => ({ ...current, folder: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Source</label>
                    <select
                      className="form-input"
                      value={formData.source}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, source: event.target.value as LeadSource }))
                      }
                    >
                      {sourceOptions.map((source) => (
                        <option key={source} value={source}>
                          {formatSource(source)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="lead-summary-row">
                    <span>Source</span>
                    <strong>{formatSource(lead.source)}</strong>
                  </div>
                  <div className="lead-summary-row">
                    <span>Folder</span>
                    <strong>{lead.folder || 'Uncategorized'}</strong>
                  </div>
                  <div className="lead-summary-row">
                    <span>Zoom Phone</span>
                    <strong>{lead.zoomPhoneNumber || 'Not linked'}</strong>
                  </div>
                  <div className="lead-summary-row">
                    <span>Lead score</span>
                    <strong>{lead.leadScore ?? 0}/100</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showReminderForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-2xl">
            <div className="card-header">
              <div>
                <h3 className="card-title">Create Reminder</h3>
                <p className="card-subtitle">{lead.name}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowReminderForm(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="card-body space-y-4">
              <input
                type="text"
                placeholder="Reminder title"
                className="form-input"
                value={reminderTitle}
                onChange={(event) => setReminderTitle(event.target.value)}
              />
              <textarea
                placeholder="Optional note"
                className="form-input"
                value={reminderNote}
                onChange={(event) => setReminderNote(event.target.value)}
              />
              <input
                type="datetime-local"
                className="form-input"
                value={remindAt}
                onChange={(event) => setRemindAt(event.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReminderForm(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={createReminder}>
                  Save Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadDetails;
