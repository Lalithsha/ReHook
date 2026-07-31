'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import MetricsCards from '@/components/MetricsCards';
import WebhookDrawer from '@/components/WebhookDrawer';
import QuickDispatchModal from '@/components/QuickDispatchModal';
import { WebhookJob, fetchWebhooks } from '@/lib/api';
import { Activity, RefreshCw, Send, Search, Filter, AlertCircle, Eye } from 'lucide-react';

export default function DashboardPage() {
  const [webhooks, setWebhooks] = useState<WebhookJob[]>([]);
  const [totalWebhooks, setTotalWebhooks] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Drawer & Modal states
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookJob | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  const loadData = async (showLoadingSpinner = false) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const res = await fetchWebhooks(100, 0, filterStatus);
      setWebhooks(res.webhooks || []);
      setTotalWebhooks(res.total || (res.webhooks ? res.webhooks.length : 0));
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Unable to connect to ReHook API server');
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, [filterStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, filterStatus]);

  // Client-side search filtering
  const filteredWebhooks = webhooks.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = w.id.toLowerCase().includes(q);
    const urlMatch = (w.target_url || w.targetUrl || '').toLowerCase().includes(q);
    const eventMatch = (w.event_type || w.eventType || '').toLowerCase().includes(q);
    return idMatch || urlMatch || eventMatch;
  });

  // Calculate metrics stats
  const deliveredCount = webhooks.filter((w) => w.status === 'delivered').length;
  const deadCount = webhooks.filter((w) => w.status === 'dead').length;
  const retryingCount = webhooks.filter((w) => ['retrying', 'pending', 'processing'].includes(w.status)).length;

  const statusOptions = ['ALL', 'DELIVERED', 'RETRYING', 'PENDING', 'DEAD'];

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'status-pill-delivered';
      case 'retrying':
      case 'processing':
      case 'pending':
        return 'status-pill-retrying';
      case 'dead':
      case 'failed':
        return 'status-pill-dead';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        lastUpdated={lastUpdated}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Title & Action Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 backdrop-blur-2xl border border-slate-800/80 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-1 z-10">
            <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight flex items-center gap-3 whitespace-nowrap">
              <div className="w-10 h-10 rounded-xl bg-sky-950/80 border border-sky-500/40 flex items-center justify-center shrink-0 shadow-inner">
                <Activity className="w-5 h-5 text-sky-400 shrink-0" />
              </div>
              <span className="bg-gradient-to-r from-white via-slate-100 to-sky-200 bg-clip-text text-transparent">
                Live Webhook Stream & Telemetry
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Real-time delivery status monitor, exponential jitter retries, and Redis circuit breaker state.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 z-10">
            <button
              onClick={() => loadData(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700/80 flex items-center gap-2 transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 text-sky-400 shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap font-mono">Refresh</span>
            </button>
            <button
              onClick={() => setIsDispatchModalOpen(true)}
              className="vibe-btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 whitespace-nowrap"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Dispatch Webhook</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 rounded-lg font-mono text-[11px] text-white whitespace-nowrap border border-rose-500/30"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Metrics KPI Cards */}
        <MetricsCards
          total={totalWebhooks}
          delivered={deliveredCount}
          retrying={retryingCount}
          dead={deadCount}
          loading={loading}
        />

        {/* Filters & Search Control Bar */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
          
          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1.5 whitespace-nowrap font-semibold">
              <Filter className="w-3.5 h-3.5 text-sky-400 shrink-0" /> Status:
            </span>
            {statusOptions.map((status) => {
              const active = filterStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25 border border-sky-400/40'
                      : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search URL, ID, or Event..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-slate-500"
            />
          </div>

        </div>

        {/* Webhooks Stream Table */}
        <div className="rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              
              <thead className="bg-slate-950/90 border-b border-slate-800/80 text-slate-400 font-mono uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-4 px-4 font-bold whitespace-nowrap">Webhook ID</th>
                  <th className="py-4 px-4 font-bold whitespace-nowrap">Event Type</th>
                  <th className="py-4 px-4 font-bold whitespace-nowrap">Target URL</th>
                  <th className="py-4 px-4 font-bold text-center whitespace-nowrap">Status</th>
                  <th className="py-4 px-4 font-bold text-center whitespace-nowrap">Attempts</th>
                  <th className="py-4 px-4 font-bold text-right whitespace-nowrap">Timestamp</th>
                  <th className="py-4 px-4 font-bold text-center whitespace-nowrap">Inspect</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/50 font-mono text-slate-300">
                {loading && webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 animate-pulse font-mono">
                      Loading delivery stream from ReHook engine...
                    </td>
                  </tr>
                ) : filteredWebhooks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 space-y-3">
                      <p className="font-mono text-xs">No webhooks matching current filter criteria.</p>
                      <button
                        onClick={() => setIsDispatchModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-sky-950 border border-sky-500/40 text-sky-400 text-xs font-bold whitespace-nowrap"
                      >
                        Dispatch a Test Webhook
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredWebhooks.map((w) => {
                    const targetUrl = w.target_url || w.targetUrl;
                    const eventType = w.event_type || w.eventType;
                    const attemptCount = w.attempt_count ?? w.attemptCount ?? 0;
                    const maxAttempts = w.max_attempts ?? w.maxAttempts ?? 5;
                    const createdAt = w.created_at || w.createdAt;

                    return (
                      <tr
                        key={w.id}
                        onClick={() => setSelectedWebhook(w)}
                        className="hover:bg-slate-800/40 hover:border-l-2 hover:border-l-sky-400 cursor-pointer transition-all duration-150 group"
                      >
                        {/* ID */}
                        <td className="py-3.5 px-4 font-bold text-sky-400 group-hover:text-sky-300 group-hover:underline whitespace-nowrap">
                          {w.id.slice(0, 8)}...
                        </td>

                        {/* Event Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold whitespace-nowrap shadow-sm">
                            {eventType}
                          </span>
                        </td>

                        {/* Target URL */}
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-300 whitespace-nowrap">
                          {targetUrl}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getStatusBadgeStyle(w.status)}`}>
                            {w.status === 'retrying' || w.status === 'pending' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0 shadow-[0_0_8px_#38bdf8]" />
                            ) : null}
                            {w.status}
                          </span>
                        </td>

                        {/* Attempts */}
                        <td className="py-3.5 px-4 text-center text-slate-400 whitespace-nowrap">
                          <span className="text-white font-bold">{attemptCount}</span> / {maxAttempts}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 text-right text-slate-400 text-[11px] whitespace-nowrap">
                          {createdAt ? new Date(createdAt).toLocaleTimeString() : 'N/A'}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWebhook(w);
                            }}
                            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-sky-900/80 text-slate-300 hover:text-sky-300 transition-all border border-slate-700/60 shadow-sm"
                            title="Inspect Payload & Logs"
                          >
                            <Eye className="w-4 h-4 shrink-0" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

            </table>
          </div>
        </div>

      </main>

      {/* Inspector Slide-over Drawer */}
      <WebhookDrawer
        webhook={selectedWebhook}
        onClose={() => setSelectedWebhook(null)}
        onRefresh={() => loadData(false)}
      />

      {/* Dispatch Test Modal */}
      <QuickDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        onSuccess={() => loadData(true)}
      />
    </div>
  );
}
