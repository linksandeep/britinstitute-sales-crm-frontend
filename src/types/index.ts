// Authentication Types

export interface AssignmentHistoryItem {
  _id: string;
  assignedTo?: User;
  assignedBy?: User | null;
  assignedAt: string;
  source: 'Manual' | 'Bulk' | 'Import' | 'Reimport' | 'System';
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  lastLogin?: string;
  canWorkFromHome: boolean, 
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  phone?: string;
  canWorkFromHome: boolean
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Lead Types
// Lead Types (BACKWARD COMPATIBLE)
export interface Lead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  zoomPhoneNumber?: string;
  position: string;
  folder: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;

  assignedTo?: string;
  assignedBy?: string;
  assignedToUser?: User;
  assignedByUser?: User;

  notes: LeadNote[];
  leadScore?: number;

  // ✅ NEW — OPTIONAL (won’t break old code)
  assignmentHistory?: AssignmentHistoryItem[];
  assignmentCount?: number;
  wasAssignedInPast?: boolean;

  createdAt: string;
  updatedAt: string;
}



export interface LeadNote {
  id: string;
  content: string;
  createdBy: User;
  createdAt: string;
}

export type LeadSource =
  | 'Website'
  | 'Social Media'
  | 'Referral'
  | 'Import'
  | 'Manual'
  | 'Cold Call'
  | 'Email Campaign'
  | 'strategy_call_modal'
  | 'data_analytics_landing_page';

// LeadStatus is now dynamic - fetched from API
export type LeadStatus = string;

export type LeadPriority = 'High' | 'Medium' | 'Low';

// Status Management Types
export interface Status {
  _id: string;
  name: string;
  isDefault: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

// Dashboard Types
export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  salesDone: number;
  dnpLeads: number;
  conversionRate: number;
  averageResponseTime: number;
  leadsThisMonth: number;
  leadsGrowth: number;
  topPerformers: Array<{
    userId: string;
    userName: string;
    leadsAssigned: number;
    leadsConverted: number;
    conversionRate: number;
  }>;
  leadsBySource: Array<{
    source: LeadSource;
    count: number;
    percentage: number;
  }>;
  leadsByStatus: Array<{
    status: LeadStatus;
    count: number;
    percentage: number;
  }>;
  leadsByFolder: Array<{
    folder: string;
    count: number;
    percentage: number;
  }>;
  lastUpdated: string;
}

export interface PeriodLeadStats {
  period: 'today' | 'week' | 'month' | 'custom';
  from: string;
  to: string;
  updatedLeads: number;
  createdLeads: number;
  assignedLeads: number;
  unassignedLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  salesDone: number;
  dnpLeads: number;
  statusBreakdown: Array<{
    _id: string;
    count: number;
  }>;
  sourceBreakdown: Array<{
    _id: string;
    count: number;
  }>;
  recentUpdates: Lead[];
  lastUpdated: string;
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  pagination?: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form Types
export interface CreateLeadForm {
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  zoomPhoneNumber?: string;
  position?: string;
  folder?: string;
  source: LeadSource;
  priority: LeadPriority;
  notes?: string;
}

export interface UpdateLeadForm {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  zoomPhoneNumber?: string;
  position?: string;
  folder?: string;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
}

export interface AssignLeadForm {
  leadIds: string[];
  assignToUserId: string;
}

export interface AddNoteForm {
  leadId: string;
  content: string;
}

export interface ZoomPhoneStatus {
  configured: boolean;
  missing: string[];
  provider: string;
  mode: string;
}

export interface ZoomPhoneOwner {
  id?: string;
  name?: string;
  extension_number?: string;
  phone_number?: string;
  type?: string;
}

export interface ZoomPhoneCallLog {
  id?: string;
  call_id?: string;
  call_type?: string;
  direction?: string;
  duration?: number;
  date_time?: string;
  answer_start_time?: string;
  call_end_time?: string;
  caller_number?: string;
  callee_number?: string;
  caller_did_number?: string;
  callee_did_number?: string;
  caller_name?: string;
  callee_name?: string;
  result?: string;
  path?: string;
  recording_id?: string;
  recording_type?: string;
  owner?: ZoomPhoneOwner;
  user_id?: string;
}

export interface ZoomPhoneRecording {
  id?: string;
  call_id?: string;
  call_log_id?: string;
  call_element_id?: string;
  caller_number?: string;
  callee_number?: string;
  caller_name?: string;
  callee_name?: string;
  direction?: string;
  duration?: number;
  date_time?: string;
  end_time?: string;
  download_url?: string;
  file_url?: string;
  transcript_download_url?: string;
  recording_type?: string;
  owner?: ZoomPhoneOwner;
}

export interface ZoomPhoneLeadCallsResponse {
  call_logs: ZoomPhoneCallLog[];
  total_records?: number;
  next_page_token?: string;
  page_size?: number;
  page_count?: number;
  matched_numbers?: string[];
}

export interface ZoomPhoneLeadRecordingsResponse {
  recordings: ZoomPhoneRecording[];
  total_records?: number;
  next_page_token?: string;
  page_size?: number;
  page_count?: number;
  matched_numbers?: string[];
}

export interface ZoomMeetingsStatus {
  configured: boolean;
  missing: string[];
  provider: string;
  mode: string;
  defaultHostUserId: string;
  timezone: string;
}

export interface ZoomMeeting {
  _id: string;
  topic: string;
  agenda?: string;
  startTime: string;
  duration: number;
  timezone: string;
  lead?: Pick<Lead, '_id' | 'name' | 'email' | 'phone' | 'status'>;
  createdBy?: Pick<User, '_id' | 'name' | 'email' | 'phone'>;
  hostUser?: Pick<User, '_id' | 'name' | 'email' | 'phone'>;
  zoomMeetingId: string;
  zoomUuid?: string;
  joinUrl: string;
  startUrl?: string;
  password?: string;
  status: 'scheduled' | 'synced' | 'cancelled';
  rawZoomResponse?: Record<string, unknown>;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoomMeetingForm {
  topic: string;
  agenda?: string;
  startTime: string;
  duration: number;
  timezone?: string;
  leadId?: string;
  hostUserId?: string;
  hostZoomUserId?: string;
  joinBeforeHost?: boolean;
  waitingRoom?: boolean;
  autoRecording?: 'none' | 'local' | 'cloud';
}

// Excel Import Types
// export interface ExcelUploadResponse {
//   success: boolean;
//   message: string;
//   data: {
//     totalRows: number;
//     successfulImports: number;
//     failedImports: number;
//     errors: Array<{
//       row: number;
//       field: string;
//       message: string;
//     }>;
//     leads: Lead[];
//   };
// }
export interface ExcelUploadResponse {
  success: boolean;
  message?: string;

  // 🔽 NEW (from Google Sheet API)
  duplicateCount?: number;
  duplicateLeads?: {
    row: number;
    name: string;
    email: string;
    phone: string;
    reason: string;
  }[];

  data: {
    totalRows: number;
    successfulImports: number;
    failedImports: number;
    errors: {
      row: number;
      message: string;
    }[];
    leads: any[];
  };
}



export interface GoogleSheetImportResponse {
  success: boolean;
  message: string;
  insertedCount: number;
  duplicateCount?: number;
  duplicateLeads?: Array<{
    row: number;
    name: string;
    email: string;
    phone: string;
    reason: string;
  }>;
  note?: string;
}

// Dynamic Excel Import Types
export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnHeaders: string[];
  hasData: boolean;
}

export interface ExcelFileAnalysis {
  fileName: string;
  fileSize: number;
  sheets: ExcelSheetInfo[];
  uploadedAt: string;
}

export interface FieldMapping {
  leadField: string;
  excelColumn: string;
  isRequired: boolean;
  defaultValue?: string;
}

export interface NoteMapping {
  excelColumns: string[];
  isRequired: boolean;
}

export interface SheetPreviewData {
  headers: string[];
  sampleRows: any[][];
  totalRows: number;
}

export interface DynamicImportRequest {
  fileName: string;
  sheetName: string;
  fieldMappings: FieldMapping[];
  noteMappings?: NoteMapping[];
  skipEmptyRows: boolean;
  startFromRow: number;
}

export interface LeadFieldDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  description: string;
  options?: string[];
  defaultValue?: string;
}

export interface ImportProgress {
  isImporting: boolean;
  progress: number;
  currentStep: string;
  totalRows: number;
  processedRows: number;
}

// Filter Types
export interface LeadFilters {
  status?: LeadStatus[];
  source?: LeadSource[];
  priority?: LeadPriority[];
  assignedTo?: string[];
  folder?: string[];
  date?: string;
  fromDate?: string;
  toDate?: string;
  dateField?: 'createdAt' | 'updatedAt';
  timezoneOffsetMinutes?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  search?: string;
}

// Sidebar Navigation Type
export interface NavItem {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
  target?: string; // Add this line with the '?' to make it optional
}
