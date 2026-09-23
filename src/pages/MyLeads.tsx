import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { leadApi, statusApi } from '../lib/api';
import type { Lead, LeadStatus } from '../types';
import { defaultStatusOptions, type ReturnState } from './LeadDetails';
import LeadWhatsAppButton from '../components/LeadWhatsAppButton';
import QuickLeadSearch from '../components/QuickLeadSearch';
import StatusReminderDialog from '../components/StatusReminderDialog';
import { getLeadDateFilterSummary, toLeadCreatedAndModifiedDateParams, type DateFilterState } from '../lib/dateFilters';
import { statusNeedsReminder, type StatusReminderSchedule } from '../lib/statusReminder';
import { 
  Phone,
  Mail,
  Calendar,
  Plus,
  Search,
  RefreshCw,
  Target,
  TrendingUp,
  FolderOpen,
  ArrowLeft,
  Eye,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const MyLeads: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnState = location.state as ReturnState | null;

  const initialPage = Number.parseInt(searchParams.get('page') || '', 10) || returnState?.currentPage || 1;
  const initialPageSize = Number.parseInt(searchParams.get('size') || '', 10) || returnState?.leadsPerPage || 10;
  const initialSearch = searchParams.get('search') || returnState?.searchQuery || '';

  const isStatusName = (val?: string | null): boolean => {
    if (!val) return false;
    return (defaultStatusOptions as string[]).includes(val);
  };

  const rawStatus = (searchParams.get('status') || searchParams.get('statusFilter') || returnState?.statusFilter || returnState?.filters?.status?.[0] || '') as LeadStatus | '';
  const urlFolderParam = searchParams.get('folder') || searchParams.get('folderFilter');
  const returnFolderCandidate = returnState?.folderFilter || returnState?.selectedFolder;

  const isUrlFolderStatus = Boolean(urlFolderParam) && (urlFolderParam === rawStatus || isStatusName(urlFolderParam));
  const isReturnFolderStatus = Boolean(returnFolderCandidate) && isStatusName(returnFolderCandidate);

  const initialStatus = (rawStatus || 
    (isUrlFolderStatus && urlFolderParam ? (urlFolderParam as LeadStatus) : '') || 
    (isReturnFolderStatus && returnFolderCandidate ? (returnFolderCandidate as LeadStatus) : '')
  ) as LeadStatus | '';

  const rawFolderCandidate = (!isUrlFolderStatus && urlFolderParam)
    ? urlFolderParam
    : (!isReturnFolderStatus && returnFolderCandidate)
    ? returnFolderCandidate
    : '';

  const initialFolder = (rawFolderCandidate && !isStatusName(rawFolderCandidate)) ? rawFolderCandidate : '';

  const initialCreatedFrom =
    searchParams.get('createdFromDate') ||
    searchParams.get('createdFrom') ||
    returnState?.createdDateRange?.fromDate ||
    returnState?.createdFromDate ||
    '';
  const initialCreatedTo =
    searchParams.get('createdToDate') ||
    searchParams.get('createdTo') ||
    returnState?.createdDateRange?.toDate ||
    returnState?.createdToDate ||
    '';
  const initialModifiedFrom =
    searchParams.get('modifiedFromDate') ||
    searchParams.get('modifiedFrom') ||
    returnState?.modifiedDateRange?.fromDate ||
    returnState?.modifiedFromDate ||
    '';
  const initialModifiedTo =
    searchParams.get('modifiedToDate') ||
    searchParams.get('modifiedTo') ||
    returnState?.modifiedDateRange?.toDate ||
    returnState?.modifiedToDate ||
    '';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>(initialStatus);
  const [folderFilter, setFolderFilter] = useState(initialFolder);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'folders' | 'leads'>(() => {
    if (returnState?.currentView) return returnState.currentView as 'folders' | 'leads';
    if (initialFolder || initialStatus || searchParams.get('view') === 'leads') return 'leads';
    return 'folders';
  });
  const [selectedFolder, setSelectedFolder] = useState<string | null>(() => {
    return initialFolder || initialStatus || returnState?.selectedFolder || null;
  });
  const [folderStats, setFolderStats] = useState<Record<string, number>>({});
  const [statusStats, setStatusStats] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(Number.isFinite(initialPage) && initialPage > 1 ? initialPage : 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadsPerPage, setLeadsPerPage] = useState(
    [10, 25, 50, 100].includes(initialPageSize) ? initialPageSize : 10
  );
  const [allStats, setAllStats] = useState<{ total: number; newLeads: number; inProgress: number; closed: number }>({ total: 0, newLeads: 0, inProgress: 0, closed: 0 });
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedAssignmentLead, setSelectedAssignmentLead] = useState<any>(null);
  const [createdDateRange, setCreatedDateRange] = useState<DateFilterState>({
    fromDate: initialCreatedFrom,
    toDate: initialCreatedTo
  });
  const [modifiedDateRange, setModifiedDateRange] = useState<DateFilterState>({
    fromDate: initialModifiedFrom,
    toDate: initialModifiedTo
  });
  const [pendingStatusChange, setPendingStatusChange] = useState<
    | { kind: 'single'; leadId: string; leadName: string; status: LeadStatus }
    | { kind: 'bulk'; status: LeadStatus }
    | null
  >(null);
  const [statusReminderSubmitting, setStatusReminderSubmitting] = useState(false);

  const getDateFilters = () => toLeadCreatedAndModifiedDateParams(createdDateRange, modifiedDateRange);

  const openLeadDetails = (leadId: string) => {
    navigate(`/leads/${leadId}`, {
      state: {
        returnTo: location.pathname + location.search,
        returnSearch: location.search,
        currentPage,
        leadsPerPage,
        statusFilter: isStatusName(selectedFolder) ? selectedFolder : (statusFilter || undefined),
        folderFilter: isStatusName(folderFilter) ? undefined : (folderFilter || undefined),
        searchQuery: appliedSearchQuery || searchQuery,
        currentView,
        selectedFolder: isStatusName(selectedFolder) ? undefined : (selectedFolder || undefined),
        createdDateRange,
        modifiedDateRange
      }
    });
  };

  useEffect(() => {
    if (isUrlFolderStatus && searchParams.has('folder')) {
      const cleanParams = new URLSearchParams(location.search);
      cleanParams.delete('folder');
      cleanParams.delete('folderFilter');
      if (urlFolderParam && !cleanParams.has('status') && !cleanParams.has('statusFilter')) {
        cleanParams.set('status', urlFolderParam);
      }
      navigate(`${location.pathname}?${cleanParams.toString()}`, { replace: true });
    }
  }, []);

  const updateUrlParams = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    navigate(qs ? `${location.pathname}?${qs}` : location.pathname, { replace: true });
  };

  const handleDateChange = (
    type: 'created' | 'modified',
    field: 'fromDate' | 'toDate',
    value: string
  ) => {
    const nextCreated = type === 'created' ? { ...createdDateRange, [field]: value } : createdDateRange;
    const nextModified = type === 'modified' ? { ...modifiedDateRange, [field]: value } : modifiedDateRange;

    if (type === 'created') setCreatedDateRange(nextCreated);
    if (type === 'modified') setModifiedDateRange(nextModified);
    setCurrentPage(1);
    setSelectedLeads([]);

    updateUrlParams({
      createdFromDate: nextCreated.fromDate || null,
      createdToDate: nextCreated.toDate || null,
      createdFrom: null,
      createdTo: null,
      modifiedFromDate: nextModified.fromDate || null,
      modifiedToDate: nextModified.toDate || null,
      modifiedFrom: null,
      modifiedTo: null,
      page: null
    });
  };

  const handleClearDates = () => {
    setCreatedDateRange({ fromDate: '', toDate: '' });
    setModifiedDateRange({ fromDate: '', toDate: '' });
    setCurrentPage(1);
    setSelectedLeads([]);

    updateUrlParams({
      createdFromDate: null,
      createdToDate: null,
      createdFrom: null,
      createdTo: null,
      modifiedFromDate: null,
      modifiedToDate: null,
      modifiedFrom: null,
      modifiedTo: null,
      page: null
    });
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  useEffect(() => {
    if (currentView === 'folders') {
      fetchFolders();
      fetchAllStats();
    } else {
      fetchMyLeads();
      fetchAllStats();
    }
  }, [currentPage, statusFilter, folderFilter, currentView, leadsPerPage, appliedSearchQuery, createdDateRange, modifiedDateRange]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      
      const response = await leadApi.getFolderCounts(getDateFilters()); 
      
      if (response.success && response.data) {
        // Use 'any' temporarily to break the conflict, 
        // then cast to the specific structure we built in the backend
        const data = response.data as any;
  
        const folderData: Record<string, number> = data.folderStats || {};
        const statusData: Record<string, number> = data.statusStats || {};
  
        setFolderStats(folderData);
        setStatusStats(statusData);
  
        const availableFolders = Object.keys(folderData).sort();
        setAvailableFolders(availableFolders);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast.error('Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStats = async () => {
    try {
      const response = await leadApi.getMyLeadsStats(getDateFilters());
      if (response.success && response.data) {
        setAllStats(response.data);
      }
    } catch (error) {
      // ignore
    }
  };

  const fetchMyLeads = async () => {
    try {
      setLoading(true);
      
      const safeFolder = isStatusName(folderFilter) ? undefined : (folderFilter || undefined);
      const safeStatus = statusFilter || (isStatusName(selectedFolder) ? (selectedFolder as LeadStatus) : undefined);

      // Pass filters to the API for server-side filtering
      const response = await leadApi.getMyLeads(
        currentPage, 
        leadsPerPage, 
        safeStatus, 
        safeFolder, 
        appliedSearchQuery || undefined,
        getDateFilters()
      );
      
      if (response.success) {
        setLeads(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotalLeads(response.pagination.total);
      } else {
        toast.error(response.message || 'Failed to fetch your leads');
      }
    } catch (error) {
      toast.error('Failed to fetch your leads');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchQuery(searchQuery);
    setCurrentPage(1);
    updateUrlParams({ search: searchQuery || null, page: null });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedLeads([]);
    updateUrlParams({ page: page > 1 ? page.toString() : null });
  };

  const handlePageSizeChange = (size: number) => {
    setLeadsPerPage(size);
    setCurrentPage(1);
    setSelectedLeads([]);
    updateUrlParams({ size: size !== 10 ? size.toString() : null, page: null });
  };

  const fetchStatuses = async () => {
    try {
      const response = await statusApi.getStatuses();
      if (response.success && response.data) {
        setStatusOptions(response.data.map(s => s.name));
      }
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const applyLeadStatusUpdate = async (
    leadId: string,
    newStatus: LeadStatus,
    statusReminder?: StatusReminderSchedule
  ) => {
    try {
      const response = await leadApi.updateLead(leadId, { status: newStatus, statusReminder });
      if (response.success) {
        setLeads(prev => prev.map(lead => 
          lead._id === leadId ? { ...lead, status: newStatus } : lead
        ));
        toast.success(statusReminder ? 'Lead status updated and reminder scheduled' : 'Lead status updated successfully');
        return true;
      } else {
        toast.error(response.message || 'Failed to update lead status');
      }
    } catch (error) {
      toast.error('Failed to update lead status');
    }
    return false;
  };

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    const selectedLead = leads.find((lead) => lead._id === leadId);
    if (!selectedLead || selectedLead.status === newStatus) return;
    if (statusNeedsReminder(newStatus)) {
      setPendingStatusChange({ kind: 'single', leadId, leadName: selectedLead.name, status: newStatus });
      return;
    }
    await applyLeadStatusUpdate(leadId, newStatus);
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    setSelectedLeads(
      selectedLeads.length === leads.length 
        ? [] 
        : leads.map(lead => lead._id)
    );
  };

  const handleBulkStatusUpdate = async (statusReminder?: StatusReminderSchedule) => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to update');
      return false;
    }

    if (!bulkStatus) {
      toast.error('Please select a status');
      return false;
    }

    if (statusNeedsReminder(bulkStatus) && !statusReminder) {
      setPendingStatusChange({ kind: 'bulk', status: bulkStatus });
      return false;
    }

    setUpdatingStatus(true);

    try {
      const response = await leadApi.bulkUpdateStatus(selectedLeads, bulkStatus, statusReminder);

      if (response.success) {
        toast.success(`Successfully updated ${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''} to "${bulkStatus}"${statusReminder ? ' and scheduled reminders' : ''}`);
        setSelectedLeads([]);
        setBulkStatus('');
        fetchMyLeads(); // Refresh the leads list
        return true;
      } else {
        toast.error(response.message || 'Failed to update lead statuses');
        return false;
      }
    } catch (error) {
      toast.error('Failed to update lead statuses');
      return false;
    } finally {
      setUpdatingStatus(false);
    }
  };

  const confirmStatusReminder = async (schedule: StatusReminderSchedule) => {
    if (!pendingStatusChange) return;
    setStatusReminderSubmitting(true);
    const pending = pendingStatusChange;
    if (pending.kind === 'single') {
      const updated = await applyLeadStatusUpdate(pending.leadId, pending.status, schedule);
      if (updated) {
        setPendingStatusChange(null);
        window.dispatchEvent(new Event('reminders:refresh'));
      }
    } else {
      const updated = await handleBulkStatusUpdate(schedule);
      if (updated) {
        setPendingStatusChange(null);
        window.dispatchEvent(new Event('reminders:refresh'));
      }
    }
    setStatusReminderSubmitting(false);
  };

  const getStatusColor = (status: LeadStatus): string => {
    const colors: Record<LeadStatus, string> = {
      'New': 'bg-blue-100 text-blue-800',
      'Contacted': 'bg-yellow-100 text-yellow-800', 
      'Interested': 'bg-green-100 text-green-800',
      'Not Interested': 'bg-red-100 text-red-800',
      'Follow-up': 'bg-orange-100 text-orange-800',
      'Qualified': 'bg-purple-100 text-purple-800',
      'Proposal Sent': 'bg-indigo-100 text-indigo-800',
      'Negotiating': 'bg-pink-100 text-pink-800',
      'Sales Done': 'bg-teal-100 text-teal-800',
      'DNP': 'bg-slate-100 text-slate-800',
      'Wrong Number': 'bg-gray-100 text-gray-800',
      'Call Back': 'bg-cyan-100 text-cyan-800' // Added this line
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const stats = allStats;

  const isInitialLoading =
    loading &&
    (currentView === 'folders'
      ? availableFolders.length === 0 && Object.keys(statusStats).length === 0
      : leads.length === 0);

  if (isInitialLoading) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div className="w-full max-w-xl">
            <div className="skeleton skeleton-line mb-4 w-36" />
            <div className="skeleton mb-3 h-9 w-72" />
            <div className="skeleton skeleton-line w-full" />
          </div>
        </div>
        <div className="metric-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="metric-card">
              <div className="skeleton skeleton-line mb-5 w-28" />
              <div className="skeleton mb-4 h-8 w-20" />
              <div className="skeleton skeleton-line w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {currentView === 'leads' && (
              <button
                onClick={() => {
                  setCurrentView('folders');
                  setSelectedFolder(null);
                  setFolderFilter('');
                  setStatusFilter('');
                  setSelectedLeads([]);
                  updateUrlParams({
                    folder: null,
                    folderFilter: null,
                    status: null,
                    statusFilter: null,
                    search: null,
                    page: null
                  });
                }}
                className="btn btn-outline btn-sm"
                title="Back to folders"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-3xl font-bold text-gray-900">
              {currentView === 'folders' ? 'My Leads' : `My Leads in "${selectedFolder}"`}
            </h1>
          </div>
          {currentView === 'folders' && (
            <div className="flex items-center gap-2 mt-3"></div>
          )}
          <p className="text-gray-600 mt-2">
            {currentView === 'folders' 
              ? 'Organize your leads by folders'
              : `Manage and track your assigned leads in "${selectedFolder}"`
            }
          </p>
        </div>
        <QuickLeadSearch className="w-full max-w-sm" />

        <div className="flex items-center gap-3">
          <button
            onClick={currentView === 'folders' ? fetchFolders : fetchMyLeads}
            className="btn btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <a href="/leads/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Add Lead
          </a>
        </div>
   

      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
            <div>
              <label className="form-label">Created From</label>
              <input
                type="date"
                value={createdDateRange.fromDate}
                max={createdDateRange.toDate || undefined}
                onChange={(event) => handleDateChange('created', 'fromDate', event.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Created To</label>
              <input
                type="date"
                value={createdDateRange.toDate}
                min={createdDateRange.fromDate || undefined}
                onChange={(event) => handleDateChange('created', 'toDate', event.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Modified From</label>
              <input
                type="date"
                value={modifiedDateRange.fromDate}
                max={modifiedDateRange.toDate || undefined}
                onChange={(event) => handleDateChange('modified', 'fromDate', event.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Modified To</label>
              <input
                type="date"
                value={modifiedDateRange.toDate}
                min={modifiedDateRange.fromDate || undefined}
                onChange={(event) => handleDateChange('modified', 'toDate', event.target.value)}
                className="form-input"
              />
            </div>
            <button
              type="button"
              onClick={handleClearDates}
              className="btn btn-secondary"
            >
              Clear Dates
            </button>
            <div className="text-sm text-gray-500 md:col-span-2 xl:col-span-5">
              {getLeadDateFilterSummary(createdDateRange, modifiedDateRange)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Leads</p>
                <p className="text-2xl font-bold text-blue-600">{stats.newLeads}</p>
              </div>
              <Plus className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-orange-600">{stats.inProgress}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Closed</p>
                <p className="text-2xl font-bold text-green-600">{stats.closed}</p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar - Only show for leads view */}
      {currentView === 'leads' && (
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search your leads..."
                  className="form-input pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    const nextStatus = e.target.value as LeadStatus | '';
                    setStatusFilter(nextStatus);
                    setCurrentPage(1);
                    updateUrlParams({ status: nextStatus || null, page: null });
                  }}
                  disabled={!!(selectedFolder && statusOptions.includes(selectedFolder as LeadStatus))}
                  className="form-input w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
              <button
                type="submit"
                className="btn btn-primary w-full"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              </div>
              <div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setAppliedSearchQuery('');
                  setCreatedDateRange({ fromDate: '', toDate: '' });
                  setModifiedDateRange({ fromDate: '', toDate: '' });
                  setCurrentPage(1);
                  updateUrlParams({
                    search: null,
                    page: null,
                    createdFromDate: null,
                    createdToDate: null,
                    createdFrom: null,
                    createdTo: null,
                    modifiedFromDate: null,
                    modifiedToDate: null,
                    modifiedFrom: null,
                    modifiedTo: null
                  });
                }}
                className="btn btn-secondary w-full"
              >
                Clear Filters
              </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Groups and Folders */}
      {currentView === 'folders' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">My Leads</h2>
            <p className="text-sm text-gray-600">Click on a status or folder to view your leads</p>
          </div>
          <div className="card-body">
            <div className="lead-category-grid">
              {/* Status Groups - sorted by count */}
              {statusOptions
                .filter(status => (statusStats[status] || 0) > 0)
                .sort((a, b) => (statusStats[b] || 0) - (statusStats[a] || 0))
                .map(status => (
                <div
                  key={`status-${status}`}
	                  className="lead-category-card"
                  onClick={() => {
                    setSelectedFolder(status);
                    setCurrentView('leads');
                    setStatusFilter(status);
                    setFolderFilter('');
                    setCurrentPage(1);
                    updateUrlParams({
                      status: status,
                      statusFilter: null,
                      folder: null,
                      folderFilter: null,
                      search: null,
                      page: null
                    });
                  }}
                >
	                  <div className="lead-category-card__content">
	                    <div className={`lead-category-card__icon ${getStatusColor(status).split(' ')[0]}`}>
	                      <Target className="w-6 h-6 text-gray-700" />
	                    </div>
	                    <div className="lead-category-card__text">
	                      <h3 className="lead-category-card__title" title={status}>{status}</h3>
	                      <p className="text-sm text-gray-500">
                        {statusStats[status] || 0} lead{(statusStats[status] || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Folders - sorted by count */}
              {availableFolders
                .sort((a, b) => (folderStats[b] || 0) - (folderStats[a] || 0))
                .map(folder => (
                <div
                  key={`folder-${folder}`}
	                  className="lead-category-card"
                  onClick={() => {
                    setSelectedFolder(folder);
                    setCurrentView('leads');
                    setStatusFilter('');
                    const targetFolder = folder === 'Uncategorized' ? '' : folder;
                    setFolderFilter(targetFolder);
                    setCurrentPage(1);
                    updateUrlParams({
                      folder: targetFolder || null,
                      folderFilter: null,
                      status: null,
                      statusFilter: null,
                      search: null,
                      page: null
                    });
                  }}
                >
	                  <div className="lead-category-card__content">
	                    <div className="lead-category-card__icon bg-blue-100">
	                      <FolderOpen className="w-6 h-6 text-blue-600" />
	                    </div>
	                    <div className="lead-category-card__text">
	                      <h3 className="lead-category-card__title" title={folder}>
	                        {folder === 'Uncategorized' ? 'Uncategorized' : (folder || 'Unnamed Folder')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {folderStats[folder] || 0} lead{(folderStats[folder] || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Update Panel */}
      {currentView === 'leads' && (
        <div className="card border-l-4 border-l-green-500">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Bulk Status Update
                  </h3>
                  <p className="text-gray-600">
                    {selectedLeads.length > 0 
                      ? `Update status for ${selectedLeads.length} selected lead${selectedLeads.length > 1 ? 's' : ''}`
                      : 'Select leads below to update their status'
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="form-label">Select New Status</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="form-input"
                  disabled={updatingStatus}
                >
                  <option value="">Choose a status...</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => void handleBulkStatusUpdate()}
                disabled={selectedLeads.length === 0 || !bulkStatus || updatingStatus}
                className="btn btn-success"
              >
                {updatingStatus ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Update {selectedLeads.length > 0 ? selectedLeads.length : ''} Lead{selectedLeads.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leads Table */}
      {currentView === 'leads' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="whitespace-nowrap font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === leads.length && leads.length > 0}
                      onChange={handleSelectAll}
                      className="mr-2"
                    />
                    Select
                  </th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Lead Details</th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Contact</th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Status</th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Priority</th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Source</th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Created</th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Notes</th>
                  <th className="whitespace-nowrap font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead, index) => (
                  <tr 
                    key={lead._id} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedLeads.includes(lead._id) ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                    }`}
                    onClick={() => openLeadDetails(lead._id)}
                  >
                    <td className="whitespace-nowrap py-4 px-6" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead._id)}
                        onChange={() => handleSelectLead(lead._id)}
                      />
                    </td>
                    <td className="whitespace-nowrap py-4 px-6">
                      <div>
                      <div className="flex items-center gap-2">
  <span className="font-medium text-gray-900 text-sm">
    {lead.name}
  </span>

  {(lead.assignmentCount ?? 0) > 1 && (
    <button
      onClick={(e) => {
        e.stopPropagation(); // prevent row click
        setSelectedAssignmentLead(lead);
        setShowAssignmentModal(true);
      }}
      className="px-2 py-0.5 text-xs font-semibold rounded-full
                 bg-orange-100 text-orange-800
                 hover:bg-orange-200 transition"
      title="This lead was reassigned. Click to view history."
    >
      Reassigned ({lead.assignmentCount})
    </button>
  )}
</div>
                        
                        <div className="text-sm text-gray-500">{lead.position}</div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-4 px-6" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="w-3 h-3 text-gray-400 mr-2 flex-shrink-0" />
                          <a 
                            href={`mailto:${lead.email}`}
                            className="text-blue-600 hover:text-blue-800 truncate max-w-[180px]"
                            title={lead.email}
                          >
                            {lead.email}
                          </a>
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="w-3 h-3 text-gray-400 mr-2 flex-shrink-0" />
                          <a 
                            href={`tel:${lead.phone}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {lead.phone}
                          </a>
                        </div>
                        <div className="flex items-center text-sm">
                          <LeadWhatsAppButton lead={lead} />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-4 px-6" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead._id, e.target.value as LeadStatus)}
                        className={`px-3 py-2 rounded-full text-xs font-medium border-0 min-w-[140px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getStatusColor(lead.status)}`}
                        style={{
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 8px center',
                          backgroundSize: '12px',
                          paddingRight: '30px'
                        }}
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status} className="text-gray-900 bg-white">
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        lead.priority === 'High' ? 'bg-red-100 text-red-800' :
                        lead.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-4 px-6">
                      <span className="text-sm text-gray-600">{lead.source}</span>
                    </td>
                    <td className="whitespace-nowrap py-4 px-6">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-3 h-3 mr-2 flex-shrink-0" />
                        <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-4 px-6 max-w-xs">
                      {lead.notes && lead.notes.length > 0 ? (
                        <div className="text-sm">
                          <div className="text-gray-700 truncate max-w-[200px]" title={lead.notes[lead.notes.length - 1].content}>
                            {lead.notes[lead.notes.length - 1].content}
                          </div>
                          <div className="text-xs text-gray-500">
                            {lead.notes.length} note{lead.notes.length > 1 ? 's' : ''} - {new Date(lead.notes[lead.notes.length - 1].createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No notes</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 px-6" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openLeadDetails(lead._id)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-full transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * leadsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * leadsPerPage, totalLeads)}
                  </span>{' '}
                  of <span className="font-medium">{totalLeads}</span> leads
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Per page:</label>
                  <select
                    value={leadsPerPage}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="form-input py-1 px-2 text-sm border border-gray-300 rounded-md"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={300}>300</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn btn-sm btn-outline"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Show first, last, current, and 2 pages around current
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 2 && page <= currentPage + 2)
                    );
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`btn btn-sm ${
                        currentPage === page ? 'btn-primary' : 'btn-outline'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn btn-sm btn-outline"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State - Only show for leads view */}
      {currentView === 'leads' && leads.length === 0 && !loading && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No leads assigned</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter || folderFilter
              ? 'No leads match your search criteria'
              : 'You don\'t have any leads assigned yet'
            }
          </p>
          {!searchQuery && !statusFilter && !folderFilter && (
            <a href="/leads/new" className="btn btn-primary">
              <Plus className="w-4 h-4" />
              Create Your First Lead
            </a>
          )}
        </div>
      )}
            {/* ================= Assignment History Modal ================= */}
{showAssignmentModal && selectedAssignmentLead && (
  <div
    className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
    onClick={() => setShowAssignmentModal(false)}
  >
    <div
      className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          Assignment History - {selectedAssignmentLead.name}
        </h3>
        <button
          onClick={() => setShowAssignmentModal(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {selectedAssignmentLead.assignmentHistory?.length > 0 ? (
          selectedAssignmentLead.assignmentHistory.map((item: any) => (
            <div
              key={item._id}
              className="border rounded-lg p-3 text-sm bg-gray-50"
            >
              <div className="flex justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    Assigned to: {item.assignedTo?.name || 'Unknown'}
                  </div>
                  <div className="text-gray-600 text-xs">
                    {item.assignedTo?.email}
                  </div>
                </div>

                <span className="text-xs text-gray-500">
                  {new Date(item.assignedAt).toLocaleString()}
                </span>
              </div>

              <div className="mt-2 text-xs text-gray-700">
                Source: <span className="font-medium">{item.source}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500 text-center">
            No assignment history found
          </div>
        )}
      </div>
    </div>
  </div>
)}

      {pendingStatusChange && (
        <StatusReminderDialog
          status={pendingStatusChange.status}
          leadName={pendingStatusChange.kind === 'single' ? pendingStatusChange.leadName : undefined}
          leadCount={pendingStatusChange.kind === 'bulk' ? selectedLeads.length : 1}
          submitting={statusReminderSubmitting}
          onCancel={() => setPendingStatusChange(null)}
          onConfirm={confirmStatusReminder}
        />
      )}

    </div>
  );
};

export default MyLeads;
