import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  Headphones,
  PhoneCall,
  RefreshCw,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../lib/api';
import type { DashboardStats, PeriodLeadStats } from '../types';
import { buildCallCenterSnapshot, formatDuration } from '../lib/callCenterData';

type DashboardRange = 'today' | 'week' | 'month' | 'custom';

const getLocalDateInputValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

const getRangeLabel = (range: DashboardRange) => {
  if (range === 'today') return 'Today';
  if (range === 'week') return 'This week';
  if (range === 'month') return 'This month';
  return 'Custom range';
};

const formatMetricValue = (value?: number) => (value ?? 0).toLocaleString();

const formatLeadTimestamp = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

const DashboardSkeleton: React.FC = () => (
  <div className="page-stack">
    <div className="page-header">
      <div className="w-full max-w-xl">
        <div className="skeleton skeleton-line mb-4 w-40" />
        <div className="skeleton mb-3 h-10 w-3/4" />
        <div className="skeleton skeleton-line w-full" />
      </div>
    </div>
    <div className="metric-grid">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="metric-card">
          <div className="skeleton skeleton-line mb-6 w-28" />
          <div className="skeleton mb-4 h-8 w-24" />
          <div className="skeleton skeleton-line w-32" />
        </div>
      ))}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [periodStats, setPeriodStats] = useState<PeriodLeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<DashboardRange>('today');
  const [customRange, setCustomRange] = useState({
    from: getLocalDateInputValue(),
    to: getLocalDateInputValue()
  });

  const snapshot = useMemo(() => buildCallCenterSnapshot(stats), [stats]);
  const rangeLabel = getRangeLabel(range);

  const periodMetrics = useMemo(
    () => [
      {
        label: `Updated ${rangeLabel}`,
        value: formatMetricValue(periodStats?.updatedLeads),
        change: 'Leads changed in this view',
        tone: 'blue',
        icon: Activity
      },
      {
        label: `Created ${rangeLabel}`,
        value: formatMetricValue(periodStats?.createdLeads),
        change: 'New leads received',
        tone: 'green',
        icon: Users
      },
      {
        label: 'Assigned',
        value: formatMetricValue(periodStats?.assignedLeads),
        change: 'Updated leads with an owner',
        tone: 'violet',
        icon: UserCheck
      },
      {
        label: 'Unassigned',
        value: formatMetricValue(periodStats?.unassignedLeads),
        change: 'Needs manager attention',
        tone: 'amber',
        icon: UserMinus
      },
      {
        label: 'Contacted',
        value: formatMetricValue(periodStats?.contactedLeads),
        change: 'Updated leads in Contacted',
        tone: 'green',
        icon: PhoneCall
      },
      {
        label: 'Qualified',
        value: formatMetricValue(periodStats?.qualifiedLeads),
        change: 'Updated qualified leads',
        tone: 'blue',
        icon: CheckCircle2
      },
      {
        label: 'Sales Done',
        value: formatMetricValue(periodStats?.salesDone),
        change: 'Updated closed sales',
        tone: 'green',
        icon: ArrowUpRight
      },
      {
        label: 'Call Records',
        value: '0',
        change: 'Phone call sync will be connected in the next phase',
        tone: 'slate',
        icon: Clock
      }
    ],
    [periodStats, rangeLabel]
  );

  const statusChartData = useMemo(
    () =>
      (periodStats?.statusBreakdown ?? []).map((item) => ({
        label: item._id || 'No status',
        count: item.count
      })),
    [periodStats]
  );

  const sourceChartData = useMemo(
    () =>
      (periodStats?.sourceBreakdown ?? []).map((item) => ({
        label: item._id || 'No source',
        count: item.count
      })),
    [periodStats]
  );

  const recentUpdates = periodStats?.recentUpdates ?? [];
  const performers = stats?.topPerformers ?? [];

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const periodRange = range === 'custom' ? customRange : undefined;
      const [summaryResponse, periodResponse] = await Promise.all([
        user?.role === 'admin' ? dashboardApi.getAdminStats() : dashboardApi.getStats(),
        dashboardApi.getPeriodStats(range, periodRange)
      ]);

      if (summaryResponse.success && summaryResponse.data) {
        setStats(summaryResponse.data);
      } else {
        setError(summaryResponse.message || 'Failed to fetch dashboard statistics');
      }

      if (periodResponse.success && periodResponse.data) {
        setPeriodStats(periodResponse.data);
      } else {
        setError(periodResponse.message || 'Failed to fetch period dashboard statistics');
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, [customRange, range, user?.role]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 text-rose-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Dashboard unavailable</h1>
              <p className="mt-1 text-sm text-gray-600">{error}</p>
              <button type="button" onClick={fetchStats} className="btn btn-primary btn-sm mt-4">
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">
            <Headphones className="h-4 w-4" />
            Phone Calling Command Center
          </div>
          <h1 className="page-title">Call Center CRM Dashboard</h1>
          <p className="page-description">
            Monitor lead movement, owner coverage, CRM outcomes, and phone-calling readiness from one operational view.
            Daily mode shows leads updated today.
          </p>
        </div>

        <div className="page-actions">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as DashboardRange)}
            className="form-input w-auto"
            aria-label="Report range"
          >
            <option value="today">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="custom">Custom range</option>
          </select>
          {range === 'custom' && (
            <>
              <input
                type="date"
                value={customRange.from}
                onChange={(event) => setCustomRange((current) => ({ ...current, from: event.target.value }))}
                className="form-input w-auto"
                aria-label="Custom range start date"
              />
              <input
                type="date"
                value={customRange.to}
                onChange={(event) => setCustomRange((current) => ({ ...current, to: event.target.value }))}
                className="form-input w-auto"
                aria-label="Custom range end date"
              />
            </>
          )}
          <button type="button" className="btn btn-secondary" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link to="/calls" className="btn btn-primary">
            <PhoneCall className="h-4 w-4" />
            Open Calls
          </Link>
        </div>
      </div>

      <div className="metric-grid">
        {periodMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className={`metric-card metric-card--${metric.tone}`}>
              <div className="metric-card__top">
                <p className="metric-card__label">{metric.label}</p>
                <Icon className="h-5 w-5" />
              </div>
              <p className="metric-card__value">{metric.value}</p>
              <p className="metric-card__change">{metric.change}</p>
            </div>
          );
        })}
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Updated Leads by Status</h2>
              <p className="card-subtitle">Status distribution for {rangeLabel.toLowerCase()}</p>
            </div>
            <span className="status-pill status-pill--green">{formatMetricValue(periodStats?.updatedLeads)} updated</span>
          </div>
          <div className="card-body h-[320px]">
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#edf0f4" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="lead-empty-state h-full">
                <Activity className="h-10 w-10" />
                <h3>No lead updates in this period</h3>
                <p>Change the report range or refresh after new lead activity is recorded.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Active Calls</h2>
              <p className="card-subtitle">Current live phone sessions</p>
            </div>
            <span className="status-pill status-pill--rose">{snapshot.activeCalls.length} live</span>
          </div>
          <div className="card-body">
            {snapshot.activeCalls.length > 0 ? (
              snapshot.activeCalls.map((call) => (
                <div key={call.id} className="list-row">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{call.customerName}</p>
                    <p className="text-xs text-gray-500">{call.phone}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-600">{call.agent}</p>
                  </div>
                  <div className="text-right">
                    <span className="status-pill status-pill--green">{call.direction}</span>
                    <p className="mt-2 text-sm font-bold text-gray-900">{formatDuration(call.elapsedSeconds)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="lead-empty-state min-h-[220px]">
                <PhoneCall className="h-10 w-10" />
                <h3>No live calls synced</h3>
                <p>Live sessions will appear when the phone service exposes active-call data.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Agent CRM Performance</h2>
              <p className="card-subtitle">Assigned leads, closed sales, and conversion from real CRM records</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Assigned Leads</th>
                  <th>Sales Done</th>
                  <th>Conversion</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {performers.length > 0 ? (
                  performers.map((agent) => (
                    <tr key={agent.userId}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="avatar">{agent.userName.charAt(0)}</span>
                          <div>
                            <p className="font-bold text-gray-900">{agent.userName}</p>
                            <p className="text-xs text-gray-500">Lead ownership performance</p>
                          </div>
                        </div>
                      </td>
                      <td>{agent.leadsAssigned.toLocaleString()}</td>
                      <td>{agent.leadsConverted.toLocaleString()}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress-bar w-24">
                            <div
                              className="progress-bar__fill text-green-600"
                              style={{ width: `${Math.min(agent.conversionRate, 100)}%` }}
                            />
                          </div>
                          <span className="font-bold">{agent.conversionRate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="status-pill status-pill--blue">Active</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="lead-empty-state min-h-[180px]">
                        <Users className="h-10 w-10" />
                        <h3>No performer data yet</h3>
                        <p>Agent performance will appear after leads are assigned and converted.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Call Queue</h2>
              <p className="card-subtitle">Priority callbacks and waiting callers</p>
            </div>
          </div>
          <div className="card-body">
            {snapshot.queue.length > 0 ? (
              snapshot.queue.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.caller}</p>
                    <p className="text-xs text-gray-500">{item.phone}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.source}</p>
                  </div>
                  <div className="text-right">
                    <span className={`status-pill ${item.priority === 'High' ? 'status-pill--rose' : 'status-pill--slate'}`}>
                      {item.priority}
                    </span>
                    <p className="mt-2 text-sm font-bold text-gray-900">{formatDuration(item.waitSeconds)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="lead-empty-state min-h-[220px]">
                <Headphones className="h-10 w-10" />
                <h3>No call queue synced</h3>
                <p>Use the Call Management page to work from real lead queues until live call queue data is available.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="three-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Updated Leads by Source</h2>
              <p className="card-subtitle">Source mix for {rangeLabel.toLowerCase()}</p>
            </div>
          </div>
          <div className="card-body h-64">
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceChartData} margin={{ left: -24, right: 4, top: 6, bottom: 0 }}>
                  <CartesianGrid stroke="#edf0f4" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="lead-empty-state h-full">
                <Activity className="h-10 w-10" />
                <h3>No source data in this period</h3>
                <p>Source analytics will appear when leads are updated in the selected range.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Lead Updates</h2>
              <p className="card-subtitle">Latest records updated in the selected range</p>
            </div>
          </div>
          <div className="card-body">
            {recentUpdates.length > 0 ? (
              recentUpdates.slice(0, 5).map((lead) => (
                <Link key={lead._id} to={`/leads/${lead._id}`} className="list-row transition-colors hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{lead.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {lead.assignedToUser?.name || 'Unassigned'} · {formatLeadTimestamp(lead.updatedAt)}
                    </p>
                  </div>
                  <span className="status-pill status-pill--violet">{lead.status}</span>
                </Link>
              ))
            ) : (
              <div className="lead-empty-state min-h-[220px]">
                <Activity className="h-10 w-10" />
                <h3>No recent lead updates</h3>
                <p>Updated leads will appear here as soon as activity is saved.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Integration Roadmap</h2>
              <p className="card-subtitle">Architecture slots reserved for expansion</p>
            </div>
          </div>
          <div className="card-body">
            {snapshot.roadmap.map((item) => (
              <div key={item.name} className="list-row">
                <div>
                  <p className="text-sm font-bold text-gray-900">{item.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                </div>
                <span className="status-pill status-pill--amber">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4" />
          <span>Report mode: {range === 'custom' ? 'Custom date range' : range}</span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4" />
          <span>Last updated {new Date(periodStats?.lastUpdated ?? snapshot.lastUpdated).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
