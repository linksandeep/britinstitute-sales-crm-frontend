import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { leadApi, statusApi } from '../lib/api';
import type { Lead, LeadStatus } from '../types';
import LeadWhatsAppButton from '../components/LeadWhatsAppButton';
import QuickLeadSearch from '../components/QuickLeadSearch';
import { toLeadDateFilterParams, type DateFilterState } from '../lib/dateFilters';
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
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [folderFilter, setFolderFilter] = useState('');
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'folders' | 'leads'>('folders');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderStats, setFolderStats] = useState<Record<string, number>>({});
  const [statusStats, setStatusStats] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  const [allStats, setAllStats] = useState<{ total: number; newLeads: number; inProgress: number; closed: number }>({ total: 0, newLeads: 0, inProgress: 0, closed: 0 });
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedAssignmentLead, setSelectedAssignmentLead] = useState<any>(null);
  const [dateRange, setDateRange] = useState<DateFilterState>({ fromDate: '', toDate: '' });

  const getDateFilters = () => toLeadDateFilterParams(dateRange, 'createdAt');

  // Initialize state from URL parameters on component mount
  useEffect(() => {
    const page = searchParams.get('page');
    const size = searchParams.get('size');
    const search = searchParams.get('search');
    const folder = searchParams.get('folder');
    const status = searchParams.get('status');
    const folderFilterParam = searchParams.get('folderFilter');

    if (page && parseInt(page) > 1) {
      setCurrentPage(parseInt(page));
    }
    if (size && [10, 25, 50, 100].includes(parseInt(size))) {
      setLeadsPerPage(parseInt(size));
    }
    if (search) {
      setSearchQuery(search);
    }
    if (folder) {
      setSelectedFolder(folder);
      setCurrentView('leads');
    }
    if (status) {
      setStatusFilter(status as LeadStatus);
    }
    if (folderFilterParam) {
      setFolderFilter(folderFilterParam);
    }
  }, []); // Only run on mount

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
  }, [currentPage, statusFilter, folderFilter, currentView, leadsPerPage, appliedSearchQuery, dateRange]);

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
      
      // Pass filters to the API for server-side filtering
      const response = await leadApi.getMyLeads(
        currentPage, 
        leadsPerPage, 
        statusFilter || undefined, 
        folderFilter || undefined, 
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
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedLeads([]); // Clear selection when changing pages
  };

  const handlePageSizeChange = (size: number) => {
    setLeadsPerPage(size);
    setCurrentPage(1);
    setSelectedLeads([]); // Clear selection when changing page size
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

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const response = await leadApi.updateLead(leadId, { status: newStatus });
      if (response.success) {
        setLeads(prev => prev.map(lead => 
          lead._id === leadId ? { ...lead, status: newStatus } : lead
        ));
        toast.success('Lead status updated successfully');
      } else {
        toast.error(response.message || 'Failed to update lead status');
      }
    } catch (error) {
      toast.error('Failed to update lead status');
    }
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

  const handleBulkStatusUpdate = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to update');
      return;
    }

    if (!bulkStatus) {
      toast.error('Please select a status');
      return;
    }

    setUpdatingStatus(true);

    try {
      const response = await leadApi.bulkUpdateStatus(selectedLeads, bulkStatus);

      if (response.success) {
        toast.success(`Successfully updated ${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''} to "${bulkStatus}"`);
        setSelectedLeads([]);
        setBulkStatus('');
        fetchMyLeads(); // Refresh the leads list
      } else {
        toast.error(response.message || 'Failed to update lead statuses');
      }
    } catch (error) {
      toast.error('Failed to update lead statuses');
    } finally {
      setUpdatingStatus(false);
    }
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
                  setSelectedLeads([]);
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <div>
              <label className="form-label">Created From</label>
              <input
                type="date"
                value={dateRange.fromDate}
                onChange={(event) => {
                  setDateRange((current) => ({ ...current, fromDate: event.target.value }));
                  setCurrentPage(1);
                  setSelectedLeads([]);
                }}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Created To</label>
              <input
                type="date"
                value={dateRange.toDate}
                onChange={(event) => {
                  setDateRange((current) => ({ ...current, toDate: event.target.value }));
                  setCurrentPage(1);
                  setSelectedLeads([]);
                }}
                className="form-input"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDateRange({ fromDate: '', toDate: '' });
                setCurrentPage(1);
                setSelectedLeads([]);
              }}
              className="btn btn-secondary"
            >
              Clear Dates
            </button>
            <div className="text-sm text-gray-500">
              {dateRange.fromDate || dateRange.toDate
                ? `Showing leads created ${dateRange.fromDate || 'from start'} to ${dateRange.toDate || 'today'}`
                : 'Showing leads from all dates'}
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
                  onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')}
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
                  setDateRange({ fromDate: '', toDate: '' });
                  setCurrentPage(1);
                  // Don't clear folder/status filter - it stays locked
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Status Groups - sorted by count */}
              {statusOptions
                .filter(status => (statusStats[status] || 0) > 0)
                .sort((a, b) => (statusStats[b] || 0) - (statusStats[a] || 0))
                .map(status => (
                <div
                  key={`status-${status}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedFolder(status);
                    setCurrentView('leads');
                    setStatusFilter(status);
                    setFolderFilter(''); // Clear folder filter when selecting status
                    setCurrentPage(1);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getStatusColor(status).split(' ')[0]}`}>
                      <Target className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{status}</h3>
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
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedFolder(folder);
                    setCurrentView('leads');
                    setStatusFilter(''); // Clear status filter when selecting folder
                    setCurrentPage(1);
                    if (folder === 'Uncategorized') {
                      setFolderFilter('');
                    } else {
                      setFolderFilter(folder);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <FolderOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 truncate max-w-[180px]" title={folder}>
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
                onClick={handleBulkStatusUpdate}
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
                    onClick={() => navigate(`/leads/${lead._id}`)}
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
                        onClick={() => navigate(`/leads/${lead._id}`, {
                          state: {
                            returnTo: '/my-leads',
                            currentPage,
                            leadsPerPage,
                            statusFilter,
                            folderFilter,
                            searchQuery,
                            currentView,
                            selectedFolder
                          }
                        })}
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

    </div>
  );
};

export default MyLeads;
