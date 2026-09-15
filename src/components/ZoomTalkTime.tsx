import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, PhoneCall, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { zoomPhoneApi } from '../lib/api';
import type { ZoomTalkTimeResponse } from '../types';

const formatTalkTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}h ${minutes}m ${remainder}s` : `${minutes}m ${remainder}s`;
};

export default function ZoomTalkTime() {
  const { user } = useAuth();
  const [data, setData] = useState<ZoomTalkTimeResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let active = true;
    let pending = false;
    setData(null);
    setError('');
    setLoading(true);
    const fetchTalkTime = async () => {
      if (pending || !user?._id) return;
      pending = true;
      setLoading(true);
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const response = await zoomPhoneApi.getMyTalkTime(timezone);
        if (!active) return;
        if (response.success && response.data) {
          setData(response.data);
          setError('');
        } else {
          setError(response.message || 'Unable to load your Zoom talk time.');
        }
      } catch {
        if (active) setError('Unable to load your Zoom talk time.');
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    refreshRef.current = fetchTalkTime;
    void fetchTalkTime();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchTalkTime();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      refreshRef.current = () => {};
    };
  }, [user?._id]);

  return (
    <section className="card" aria-label="Your Zoom talk time" aria-busy={loading}>
      <div className="card-header">
        <div>
          <h2 className="card-title">Your Zoom Talk Time</h2>
          <p className="card-subtitle">Completed phone calls · This week starts Sunday</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading} aria-label="Refresh your Zoom talk time">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <div className="card-body">
        {error ? (
          <div className="flex items-start gap-2 text-sm text-rose-600" role="alert">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : data && !data.linked ? (
          <p className="text-sm text-gray-600">Your Zoom Phone account is not linked yet. Ask your CRM admin to check your Zoom email or phone-number assignment.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Today', seconds: data?.daily.talk_time_seconds, count: data?.daily.connected_calls, icon: PhoneCall },
              { label: 'This week', seconds: data?.weekly.talk_time_seconds, count: data?.weekly.connected_calls, icon: Clock }
            ].map(({ label, seconds, count, icon: Icon }) => (
              <div key={label} className="metric-card metric-card--blue">
                <div className="metric-card__top">
                  <p className="metric-card__label">{label}</p>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="metric-card__value">{seconds === undefined ? 'Loading…' : formatTalkTime(seconds)}</p>
                <p className="metric-card__change">{count === undefined ? 'Retrieving Zoom calls' : `${count} connected ${count === 1 ? 'call' : 'calls'}`}</p>
              </div>
            ))}
          </div>
        )}
        {data && !error && data.linked && (
          <p className="mt-3 text-xs text-gray-500">
            {data.timezone} · Week: {data.weekly.from} to {data.weekly.to} · Updated {new Date(data.updated_at).toLocaleTimeString()} · Refreshes every minute
          </p>
        )}
      </div>
    </section>
  );
}
