'use client';

import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Clock, Play, RefreshCw, Send, AlertCircle, Layers } from 'lucide-react';

interface WebhookJob {
  id: string;
  target_url: string;
  event_type: string;
  status: 'pending' | 'processing' | 'delivered' | 'retrying' | 'failed' | 'dead';
  attempt_count: number;
  max_attempts: number;
  replay_count: number;
  created_at: string;
}

export default function DashboardPage() {
  const [webhooks, setWebhooks] = useState<WebhookJob[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Dispatch Form State
  const [targetUrl, setTargetUrl] = useState('https://httpbin.org/post');
  const [eventType, setEventType] = useState('order.completed');
  const [submitting, setSubmitting] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3001/api/v1/webhooks?limit=50', {
        headers: {
          'x-api-key': 'super_secret_rehook_key_123',
        },
      });

      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setWebhooks(data.webhooks || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to ReHook API server on port 3001');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    const interval = setInterval(fetchWebhooks, 4000); // Auto-refresh every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTriggerMessage(null);

    try {
      const res = await fetch('http://localhost:3001/api/v1/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'super_secret_rehook_key_123',
        },
        body: JSON.stringify({
          target_url: targetUrl,
          event_type: eventType,
          payload: {
            source: 'ReHook Console',
            timestamp: new Date().toISOString(),
            order_id: `ORD-${Math.floor(Math.random() * 90000) + 10000}`,
            amount: 2999.00,
          },
          retry_config: {
            max_attempts: 5,
            initial_delay_ms: 3000,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTriggerMessage(`✅ Webhook Enqueued! ID: ${data.webhook_id}`);
        fetchWebhooks();
      } else {
        setTriggerMessage(`❌ Dispatch Error: ${data.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      setTriggerMessage(`❌ Network Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredWebhooks = webhooks.filter((w) => {
    if (filter === 'ALL') return true;
    return w.status.toUpperCase() === filter;
  });

  const totalCount = webhooks.length;
  const deliveredCount = webhooks.filter((w) => w.status === 'delivered').length;
  const deadCount = webhooks.filter((w) => w.status === 'dead').length;
  const retryingCount = webhooks.filter((w) => ['retrying', 'pending', 'processing'].includes(w.status)).length;
  const successRate = totalCount > 0 ? ((deliveredCount / totalCount) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-8">

      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-6 h-6 text-sky-400" />
            Live Webhook Delivery Monitor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time delivery status tracking, exponential jitter retries & circuit breaker orchestrator.
          </p>
        </div>
        <button
          onClick={fetchWebhooks}
          className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 border border-slate-700/80 flex items-center gap-2 transition-all shadow-sm active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Ingested */}
        <div className="glass-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Ingested</span>
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center">
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{totalCount}</div>
          <p className="text-xs text-slate-500">Events processed in queue</p>
        </div>

        {/* Success Rate */}
        <div className="glass-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Success Rate</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{successRate}%</div>
          <p className="text-xs text-slate-500">{deliveredCount} delivered successfully</p>
        </div>

        {/* Active Retries */}
        <div className="glass-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Retries</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400">{retryingCount}</div>
          <p className="text-xs text-slate-500">In BullMQ backoff queue</p>
        </div>

        {/* Dead Letters */}
        <div className="glass-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Dead Letters (DLQ)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/60 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-400">{deadCount}</div>
          <p className="text-xs text-slate-500">Exhausted max attempts</p>
        </div>

      </div>

      {/* Quick Dispatch Webhook Form */}
      <div className="glass-panel p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-400" />
          Dispatch Test Webhook Event
        </h2>
        
        <form onSubmit={handleRegisterWebhook} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Target Webhook Endpoint URL</label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="input-field font-mono"
              placeholder="https://httpbin.org/post"
            />
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Event Type</label>
            <input
              type="text"
              required
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="input-field font-mono"
              placeholder="order.completed"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 font-bold text-xs text-white shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              Enqueue Webhook
            </button>
          </div>
        </form>

        {triggerMessage && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-200">
            {triggerMessage}
          </div>
        )}
      </div>

      {/* Webhook Deliveries Filter & Data Table */}
      <div className="glass-panel overflow-hidden">
        
        <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-base text-white">Recent Webhook Deliveries</h3>

          {/* Filter Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80 text-xs font-semibold">
            {['ALL', 'PENDING', 'DELIVERED', 'RETRYING', 'DEAD'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filter === f
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase font-bold text-slate-400 border-b border-slate-800/80 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Event Type</th>
                <th className="px-6 py-3.5">Target Endpoint URL</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Attempts</th>
                <th className="px-6 py-3.5">Replays</th>
                <th className="px-6 py-3.5">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredWebhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                        Fetching pipeline data...
                      </div>
                    ) : (
                      'No webhooks found in delivery pipeline.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredWebhooks.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-semibold">
                      <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-sky-300">
                        {job.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-300 max-w-xs truncate">
                      {job.target_url}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`status-badge status-${job.status.toLowerCase()}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300 font-mono">
                      <span className="font-bold text-white">{job.attempt_count}</span> / {job.max_attempts}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {job.replay_count > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80 font-bold font-mono">
                          {job.replay_count}x
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {new Date(job.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
