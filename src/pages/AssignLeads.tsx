import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leadApi, userApi, statusApi } from '../lib/api';
import type { Lead, User, LeadStatus, LeadSource } from '../types';
import InfiniteScrollUserDropdown from '../components/InfiniteScrollUserDropdown_Portal';
import LeadWhatsAppButton from '../components/LeadWhatsAppButton';
import { toLeadDateFilterParams, type DateFilterState } from '../lib/dateFilters';
import {
  UserPlus,
  Search,
  ArrowLeft,
  Users,
  Mail,
  Phone,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  Target,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const AssignLeads: React.FC = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  // We keep the users state for the *Filter* dropdown, ensuring filtering functionality works.
  const [users, setUsers] = useState<User[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateFilterState>({ fromDate: '', toDate: '' });
  const [appliedDateRange, setAppliedDateRange] = useState<DateFilterState>({ fromDate: '', toDate: '' });

  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | ''>('');
  const [folderFilter, setFolderFilter] = useState<string>('');
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'folders' | 'leads'>('folders');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderStats, setFolderStats] = useState<Record<string, number>>({});
  const [statusStats, setStatusStats] = useState<Record<string, number>>({});
  const [userFilter, setUserFilter] = useState<string>('unassigned'); // 'all', 'unassigned', or user ID

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const getDateFilters = (range = appliedDateRange) => toLeadDateFilterParams(range, 'createdAt');

  // Redirect if not admin
  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">This feature is only available to administrators.</p>
        <a href="/leads" className="btn btn-primary">Go to Leads</a>
      </div>
    );
  }

  useEffect(() => {
    if (currentView === 'folders') {
      fetchFolders();
    } else {
      fetchData();
    }
    fetchStatuses();
  }, []);

  useEffect(() => {
    if (currentView === 'leads') {
      fetchLeads();
      // Ensure users are loaded for the filter dropdown
      if (users.length === 0) {
        fetchUsers();
      }
    }
  }, [
    currentPage,
    userFilter,
    currentView,
    leadsPerPage,
    statusFilter,
    sourceFilter,
    folderFilter,
    appliedSearchQuery,
    appliedDateRange
  ]);
  
  
  const fetchData = async () => {
    await Promise.all([fetchLeads(), fetchUsers(), fetchFolders()]);
  };

  const fetchFolders = async () => {
    try {
      setLoading(true);
      
      // 1. Call the single optimized API that returns both folder and status stats
      const response = await leadApi.getFolderCountForAdmin(getDateFilters(dateRange)); 
      
      if (response.success && response.data) {
        // Cast to any to handle the specific backend structure we built
        const apiData = response.data as any;
        
        const folderData: Record<string, number> = apiData.folderStats || {};
        const statusData: Record<string, number> = apiData.statusStats || {};
  
        // 2. Set Stats (Uncategorized now contains the TOTAL count from backend)
        setFolderStats(folderData);
        setStatusStats(statusData);
  
        // 3. Update the folder list for UI tabs/dropdowns
        // We sort them but ensure 'Uncategorized' (the Total) stays at the very top
        const sortedFolders = Object.keys(folderData).sort((a, b) => {
          if (a === 'Uncategorized') return -1;
          if (b === 'Uncategorized') return 1;
          return a.localeCompare(b);
        });
        
        setAvailableFolders(sortedFolders);
      }
    } catch (error) {
      console.error('Error fetching folders/stats:', error);
      toast.error('Failed to load folders and statistics');
    } finally {
      setLoading(false);
    }
  };
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const filters: any = {};
  
      // existing filters
      if (statusFilter) filters.status = [statusFilter];
      if (sourceFilter) filters.source = [sourceFilter];
  
      if (folderFilter) {
        filters.folder = [folderFilter];
      }
  
      if (appliedSearchQuery) filters.search = appliedSearchQuery;
  
      if (userFilter === 'unassigned') {
        filters.assignedTo = null;
      } else if (userFilter !== 'all') {
        filters.assignedTo = [userFilter];
      }
  
      Object.assign(filters, getDateFilters());
  
      const response = await leadApi.getLeads(
        filters,
        currentPage,
        leadsPerPage
      );
  
      if (response.success) {
        setLeads(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setTotalLeads(response.pagination.total);
        }
      } else {
        toast.error('Failed to fetch leads');
      }
    } catch (error) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
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

  const fetchUsers = async () => {
    try {
      const response = await userApi.getUsers();
      if (response.success && response.data) {
        // Show all active users for filtering
        const activeUsers = response.data.filter(u => u.isActive);
        setUsers(activeUsers);
      }
    } catch (error) {
      console.error('Failed to fetch users');
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedLeads([]); // Clear selection when changing pages
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setLeadsPerPage(newPageSize);
    setCurrentPage(1);
    setSelectedLeads([]); // Clear selection when changing page size
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
    setSelectedLeads([]); // Clear selection when filters change
  };

  const getSourceColor = (source: LeadSource): string => {
    const colors: Record<LeadSource, string> = {
      'Website': 'bg-blue-100 text-blue-800',
      'Social Media': 'bg-purple-100 text-purple-800',
      'Referral': 'bg-green-100 text-green-800',
      'Import': 'bg-orange-100 text-orange-800',
      'Manual': 'bg-gray-100 text-gray-800',
      'Cold Call': 'bg-indigo-100 text-indigo-800',
      'Email Campaign': 'bg-pink-100 text-pink-800',
      'strategy_call_modal': 'bg-cyan-100 text-cyan-800',
      'data_analytics_landing_page': 'bg-teal-100 text-teal-800'
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  const handleFolderSelect = (folder: string) => {
    setSelectedFolder(folder);
    if (folder === 'Uncategorized') {
      setFolderFilter('Uncategorized');
    } else {
      setFolderFilter(folder);
    }
    setStatusFilter(''); // Clear status filter when selecting folder
    setCurrentView('leads');
    setCurrentPage(1);
    setSelectedLeads([]);
  };

  const handleBackToFolders = () => {
    setCurrentView('folders');
    setSelectedFolder(null);
    setFolderFilter('');
    setSearchQuery('');
    setStatusFilter('');
    setSourceFilter('');
    setDateRange({ fromDate: '', toDate: '' });
    setAppliedDateRange({ fromDate: '', toDate: '' });
    setCurrentPage(1);
    setSelectedLeads([]);
  };

  const handleAssignLeads = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to update');
      return;
    }

    // Check if at least one action is selected
    if (!selectedUser && !bulkStatus) {
      toast.error('Please select an action (assign user and/or update status)');
      return;
    }

    setAssigning(true);
    setUpdatingStatus(true);

    try {
      const actions = [];

      // Execute assignment if user is selected
      if (selectedUser) {
        if (selectedUser === 'unassign') {
          actions.push(
            leadApi.unassignLeads({
              leadIds: selectedLeads
            })
          );
        } else {
          actions.push(
            leadApi.assignLeads({
              leadIds: selectedLeads,
              assignToUserId: selectedUser
            })
          );
        }
      }

      // Execute status update if status is selected
      if (bulkStatus) {
        actions.push(
          leadApi.bulkUpdateStatus(selectedLeads, bulkStatus)
        );
      }

      // Execute all selected actions
      const responses = await Promise.all(actions);

      // Check if all actions succeeded
      const allSucceeded = responses.every(r => r.success);

      if (allSucceeded) {
        const messages = [];
        if (selectedUser) {
          const actionText = selectedUser === 'unassign' ? 'unassigned' : 'assigned';
          messages.push(`${actionText} ${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''}`);
        }
        if (bulkStatus) {
          messages.push(`updated status to "${bulkStatus}"`);
        }
        toast.success(`Successfully ${messages.join(' and ')}`);
        setSelectedLeads([]);
        setSelectedUser('');
        setBulkStatus('');
        fetchLeads(); // Refresh the leads list
      } else {
        toast.error('Some actions failed. Please check and try again.');
      }
    } catch (error) {
      toast.error('Failed to complete actions');
    } finally {
      setAssigning(false);
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
      'Sales Done': 'bg-emerald-100 text-emerald-800',
      'DNP': 'bg-slate-100 text-slate-800',
      'Wrong Number': 'bg-gray-100 text-gray-800',
      'Call Back': 'bg-cyan-100 text-cyan-800' // Added this line
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getUserNameForPreview = () => {
    if (!selectedUser) return '';
    if (selectedUser === 'unassign') return 'Unassign from current user';

    // Try to find the user in the loaded users list
    const foundUser = users.find(u => u._id === selectedUser);
    if (foundUser) {
      return `Assign to ${foundUser.name}`;
    }
    // Fallback if user is from infinite scroll but not in initial 'users' list
    return 'Assign to selected user';
  };

  const getSelectedAssigneeLabel = () => {
    if (!selectedUser) return 'No assignee selected';
    if (selectedUser === 'unassign') return 'Assignee: Unassign from current user';

    const foundUser = users.find(u => u._id === selectedUser);
    return foundUser ? `Assignee: ${foundUser.name}` : 'Assignee: Selected user';
  };

  if (loading && currentView === 'folders') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div>
              {currentView === 'leads' && (
                <button
                  onClick={handleBackToFolders}
                  className="btn btn-secondary mb-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Folders
                </button>
              )}
              <h1 className="text-3xl font-bold text-gray-900">
                {currentView === 'folders' ? 'Assign Leads' : `Assign Leads in "${selectedFolder}"`}
              </h1>
              <p className="text-gray-600 mt-2">
                {currentView === 'folders'
                  ? 'Select a folder to view and assign leads to team members'
                  : 'Assign leads to team members for follow-up'
                }
                {currentView === 'leads' && totalLeads > 0 && (
                  <span className="ml-2 text-sm">
                    ({totalLeads} total leads{totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ''})
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={currentView === 'folders' ? fetchFolders : fetchLeads}
                className="btn btn-secondary"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              {currentView === 'leads' && (
                <>
                  <span className="text-sm text-gray-500">
                    Total: <span className="font-semibold text-gray-900">{totalLeads}</span>
                  </span>
                  <span className="text-sm text-gray-500">
                    Selected: <span className="font-semibold text-blue-600">{selectedLeads.length}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Groups and Folders Combined */}
      {currentView === 'folders' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Select a Status or Folder</h2>
            <p className="text-sm text-gray-600">Click to view and assign leads</p>
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
                          {statusStats[status] || 0} lead{(statusStats[status] || 0) !== 1 ? 's' : ''} • Click to assign
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
                    onClick={() => handleFolderSelect(folder)}
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
                          {folderStats[folder] || 0} lead{(folderStats[folder] || 0) !== 1 ? 's' : ''} • Click to assign
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Combined Assignment & Status Update Panel */}
      {currentView === 'leads' && (
        <div className="card border-l-4 border-l-blue-500">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
              <UserPlus className="w-6 h-6 text-blue-600" />
                <div>
                <h3 className="text-lg font-semibold text-gray-900">
                    Bulk Assignment & Status Update
          </h3>
          <p className="text-gray-600">
                    {selectedLeads.length > 0
                      ? `${selectedLeads.length} lead${selectedLeads.length > 1 ? 's' : ''} selected - Assign and/or update status`
                      : 'Select leads below to assign users and update status'
            }
          </p>
        </div>
      </div>
      </div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
  <div
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
  >
    <label className="form-label">Assign To (Bulk Action)</label>
    <InfiniteScrollUserDropdown
      value={selectedUser}
      onChange={setSelectedUser}
      disabled={assigning || updatingStatus}
      includeUnassign={true}
      placeholder="No change to assignment"
    />
  </div>

  <div>
    <label className="form-label">Update Status (Optional)</label>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="form-input"
            disabled={assigning || updatingStatus}
          >
            <option value="">No change to status</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <div>
        <button
                  type="button"
                  onClick={handleAssignLeads}
                  disabled={selectedLeads.length === 0 || (!selectedUser && !bulkStatus) || assigning || updatingStatus}
                  className="btn btn-primary w-full"
          >
            {(assigning || updatingStatus) ? (
               <>
               <div className="loading-spinner mr-2"></div>
               Processing...
             </>
            ) : (
              <>
              <CheckCircle className="w-4 h-4" />
              Apply Changes{selectedLeads.length > 0 ? ` (${selectedLeads.length})` : ''}
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 mt-2">{getSelectedAssigneeLabel()}</p>
      </div>
    </div>

          

      {/* Improved Action Preview: Shows a summary of what will happen */}
      {selectedLeads.length > 0 && (selectedUser || bulkStatus) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 font-medium">
                  Changes to apply:
                </p>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  {selectedUser && (
                    <li>
                      • {getUserNameForPreview()}
                    </li>
                  )}
                  {bulkStatus && (
                    <li>• Update status to "{bulkStatus}"</li>
                  )}
                </ul>
        </div>
      )}
    </div>
  </div>
)}

      {/* Filters */}
      {currentView === 'leads' && (
        <div className="card">
          <div className="card-body">
            <form onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearchQuery(searchQuery);
              setAppliedDateRange(dateRange);
              setCurrentPage(1);
            }} className="grid grid-cols-1 md:grid-cols-9 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    className="form-input pl-10 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
{/* From Date */}
<div>
  <input
    type="date"
    className="form-input w-full"
    value={dateRange.fromDate}
    onChange={(e) => setDateRange((current) => ({ ...current, fromDate: e.target.value }))}
  />
</div>

{/* To Date */}
<div>
  <input
    type="date"
    className="form-input w-full"
    value={dateRange.toDate}
    onChange={(e) => setDateRange((current) => ({ ...current, toDate: e.target.value }))}
  />
</div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as LeadStatus | '');
                    handleFilterChange();
                  }}
                  className="form-input w-full"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value as LeadSource | '');
                    handleFilterChange();
                  }}
                  className="form-input w-full"
                >
                  <option value="">All Sources</option>
                  {['Website', 'Social Media', 'Referral', 'Import', 'Manual', 'Cold Call', 'Email Campaign'].map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
<div 
  className="md:col-span-1" 
  onClick={(e) => e.stopPropagation()} 
  onMouseDown={(e) => e.stopPropagation()}
>
  <label className="form-label">Filter Assignee</label>
  <InfiniteScrollUserDropdown
    // This logic ensures the UI shows "Unassign" when state is 'unassigned'
    value={userFilter === 'all' ? '' : (userFilter === 'unassigned' ? 'unassign' : userFilter)}
    onChange={(val) => {
      if (!val || val === '' || val === 'all') {
        setUserFilter('all');
      } else if (val === 'unassign' || val === 'unassigned') {
        setUserFilter('unassigned');
      } else {
        setUserFilter(val);
      }
      handleFilterChange();
    }}
    includeUnassign={true}
    placeholder="All Users"
  />
</div>

              <div>
              <button
  type="submit"
  disabled={loading}
  className="btn btn-primary w-full"
>
  {loading ? (
    <>
      <div className="loading-spinner mr-2"></div>
      Searching...
    </>
  ) : (
    <>
      <Search className="w-4 h-4" />
      Search
    </>
  )}
</button>

              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => {
                    setSearchQuery('');
                    setAppliedSearchQuery('');
                    setDateRange({ fromDate: '', toDate: '' });
                    setAppliedDateRange({ fromDate: '', toDate: '' });
                    setStatusFilter('');
                    setSourceFilter('');
                    setUserFilter('unassigned');
                    setCurrentPage(1);
                    setSelectedLeads([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leads Table */}
      {currentView === 'leads' && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Leads Assignment</h3>
              <div className="flex items-center gap-3">
  <h3 className="text-lg font-semibold">
    Leads Available for Assignment
  </h3>

  {loading && (
    <span className="flex items-center gap-2 text-sm text-gray-500">
      <div className="loading-spinner w-4 h-4"></div>
      Refreshing…
    </span>
  )}
</div>


            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full min-w-[800px]">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === leads.length && leads.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="whitespace-nowrap">Lead Details</th>
                  <th className="whitespace-nowrap">Contact Info</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap">Source</th>
                  <th className="whitespace-nowrap">Priority</th>
                  <th className="whitespace-nowrap">Created At</th>

                  <th className="whitespace-nowrap">Notes</th>
                  <th className="whitespace-nowrap">Current Assignment</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr
                    key={lead._id}
                    className={`cursor-pointer ${selectedLeads.includes(lead._id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => window.open(`/leads/${lead._id}`, '_blank')}
                  >
                    <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead._id)}
                        onChange={() => handleSelectLead(lead._id)}
                      />
                    </td>
                    <td className="whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{lead.name}</div>
                        <div className="text-sm text-gray-500">{lead.position}</div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="w-3 h-3 text-gray-400 mr-1" />
                          <a href={`mailto:${lead.email}`} className="text-blue-600 hover:text-blue-800">
                            {lead.email}
                          </a>
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="w-3 h-3 text-gray-400 mr-1" />
                          <a href={`tel:${lead.phone}`} className="text-blue-600 hover:text-blue-800">
                            {lead.phone}
                          </a>
                        </div>
                        <div className="flex items-center text-sm">
                          <LeadWhatsAppButton lead={lead} />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={`badge ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={`badge ${getSourceColor(lead.source)}`}>
                        {lead.source}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={`font-medium ${lead.priority === 'High' ? 'text-red-600' :
                          lead.priority === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-sm text-gray-600">
  {new Date(lead.createdAt).toLocaleString()}
</td>

                    <td className="whitespace-nowrap max-w-xs">
                      {lead.notes && lead.notes.length > 0 ? (
                        <div className="text-sm">
                          <div className="text-gray-700 truncate max-w-[200px]" title={lead.notes[lead.notes.length - 1].content}>
                            {lead.notes[lead.notes.length - 1].content}
                          </div>
                          <div className="text-xs text-gray-500">
                            {lead.notes.length} note{lead.notes.length > 1 ? 's' : ''} • {new Date(lead.notes[lead.notes.length - 1].createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No notes</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {lead.assignedToUser ? (
                        <div className="text-sm">
                          <div className="font-medium">{lead.assignedToUser.name}</div>
                          <div className="text-gray-500">{lead.assignedToUser.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm italic">Unassigned</span>
                      )}
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
                      className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-outline'
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

          {/* Empty State */}
          {leads.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
              <p className="text-gray-500 mb-4">
                {userFilter === 'unassigned'
                  ? 'All leads are currently assigned'
                  : userFilter === 'all'
                    ? 'No leads match your filter criteria'
                    : `No leads assigned to ${users.find(u => u._id === userFilter)?.name || 'this user'}`
                }
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setAppliedSearchQuery('');
                    setSourceFilter('');
                    setUserFilter('unassigned');
                    setCurrentPage(1);
                    setSelectedLeads([]);
                    // Don't clear statusFilter or folderFilter - they stay locked to selectedFolder
                  }}
                  className="btn btn-secondary"
                >
                  Clear Filters
                </button>
                <a href="/leads" className="btn btn-primary">
                  View All Leads
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assignment Tips */}
      {currentView === 'leads' && (
        <div className="card border-l-4 border-l-orange-500">
          <div className="card-body">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800">Assignment & Management Tips</h3>
                <div className="mt-2 text-sm text-orange-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Use the user filter to see leads assigned to specific users or unassigned leads</li>
                    <li>Select multiple leads and choose "Unassign" to remove them from their current assignee</li>
                    <li>Consider lead priority and user workload when assigning</li>
                    <li>Match lead characteristics with user expertise</li>
                    <li>Use filters to find specific types of leads for assignment</li>
                    <li>Assigned users will receive notifications about their new leads</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AssignLeads;
