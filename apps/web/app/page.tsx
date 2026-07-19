'use client';

import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Clock, Play, RefreshCw, AlertTriangle, Send } from 'lucide-react';

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

  // Quick Trigger Form State
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
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      setWebhooks(data.webhooks || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to ReHook API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    const interval = setInterval(fetchWebhooks, 5000); // Auto refresh every 5s
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
            source: 'ReHook Dashboard',
            timestamp: new Date().toISOString(),
            amount: 2999.00,
            currency: 'USD',
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
        setTriggerMessage(`❌ Error: ${data.message}`);
      }
    } catch (err: any) {
      setTriggerMessage(`❌ Network Failure: ${err.message}`);
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
  const retryingCount = webhooks.filter((w) => w.status === 'retrying' || w.status === 'pending' || w.status === 'processing').length;
  const successRate = totalCount > 0 ? ((deliveredCount / totalCount) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            Live Webhook Delivery Engine Monitor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time delivery status tracking, circuit breaking & automatic retry orchestrator.
          </p>
        </div>
        <button
          onClick={fetchWebhooks}
          className="self-start md:self-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Total Ingested</span>
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/50">
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">{totalCount}</div>
          <div className="mt-1 text-xs text-slate-500">Events processed in pipeline</div>
        </div>

        <div className="glass-card p-5 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Success Rate</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-400">{successRate}%</div>
          <div className="mt-1 text-xs text-slate-500">{deliveredCount} delivered successfully</div>
        </div>

        <div className="glass-card p-5 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Active Retries</span>
            <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/50">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-amber-400">{retryingCount}</div>
          <div className="mt-1 text-xs text-slate-500">In BullMQ backoff queue</div>
        </div>

        <div className="glass-card p-5 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Dead Letters (DLQ)</span>
            <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800/50">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-rose-400">{deadCount}</div>
          <div className="mt-1 text-xs text-slate-500">Exhausted retry attempts</div>
        </div>
      </div>

      {/* Quick Register Webhook Form */}
      <div className="glass-card p-6 border border-slate-800">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Send className="w-4 h-4 text-cyan-400" />
          Dispatch Test Webhook Event
        </h2>
        <form onSubmit={handleRegisterWebhook} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Target Webhook URL</label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              placeholder="https://httpbin.org/post"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Event Type</label>
            <input
              type="text"
              required
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              placeholder="order.completed"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 font-semibold text-sm text-white shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              Enqueue Webhook
            </button>
          </div>
        </form>
        {triggerMessage && (
          <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300">
            {triggerMessage}
          </div>
        )}
      </div>

      {/* Webhooks Filter & Table */}
      <div className="glass-card border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-bold text-base text-white">Recent Webhook Deliveries</h3>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
            {['ALL', 'PENDING', 'DELIVERED', 'RETRYING', 'DEAD'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filter === f ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Target Endpoint URL</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Attempts</th>
                <th className="px-6 py-3">Replays</th>
                <th className="px-6 py-3">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredWebhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                        Connecting to ReHook API...
                      </div>
                    ) : (
                      'No webhooks found in pipeline.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredWebhooks.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">
                      <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
                        {job.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-300 max-w-xs truncate">
                      {job.target_url}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge badge-${job.status.toLowerCase()}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      <span className="font-semibold text-white">{job.attempt_count}</span> / {job.max_attempts}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {job.replay_count > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
                          {job.replay_count}x
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
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
