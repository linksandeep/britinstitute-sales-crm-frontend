import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadApi, userApi } from '../lib/api';
import type { Lead, LeadPriority, LeadSource, LeadStatus, User as AppUser } from '../types';
import LeadWhatsAppButton from '../components/LeadWhatsAppButton';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
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

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
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
              <div className="lead-empty-state">
                <Phone className="h-10 w-10" />
                <h3>No synced call records yet</h3>
                <p>Real call logs and recordings will appear here after the phone service call-history API is connected.</p>
                <a href={`tel:${lead.phone}`} className="btn btn-primary">
                  <Phone className="h-4 w-4" />
                  Call Now
                </a>
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
