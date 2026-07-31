'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import WebhookDrawer from '@/components/WebhookDrawer';
import { WebhookJob, fetchDlqWebhooks, replayDlqWebhook } from '@/lib/api';
import { Skull, RefreshCw, Play, AlertCircle, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function DlqPage() {
  const [dlqWebhooks, setDlqWebhooks] = useState<WebhookJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookJob | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replayingAll, setReplayingAll] = useState(false);

  const loadDlq = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await fetchDlqWebhooks(100, 0);
      setDlqWebhooks(res.webhooks || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load Dead Letter Queue');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadDlq(true);
  }, []);

  const handleReplaySingle = async (id: string) => {
    try {
      setReplayingId(id);
      await replayDlqWebhook(id);
      toast.success(`Webhook ${id.slice(0, 8)}... replayed successfully!`);
      loadDlq(false);
    } catch (err: any) {
      toast.error(`Replay failed: ${err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  const handleReplayAll = async () => {
    if (dlqWebhooks.length === 0) return;
    try {
      setReplayingAll(true);
      let successCount = 0;
      for (const w of dlqWebhooks) {
        try {
          await replayDlqWebhook(w.id);
          successCount++;
        } catch (e) {
          console.error(`Failed to replay ${w.id}`, e);
        }
      }
      toast.success(`Bulk Replay Complete! ${successCount}/${dlqWebhooks.length} webhooks enqueued.`);
      loadDlq(true);
    } catch (err: any) {
      toast.error(`Bulk Replay Error: ${err.message}`);
    } finally {
      setReplayingAll(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center shrink-0">
              <Skull className="w-6 h-6 text-rose-400 shrink-0" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2 whitespace-nowrap">
                <span>Dead Letter Queue (DLQ) Command Center</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Inspect permanently dead-lettered webhooks that exhausted all jitter retry attempts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => loadDlq(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 flex items-center gap-2 transition-all whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-rose-400 shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">Refresh DLQ</span>
            </button>
            <button
              onClick={handleReplayAll}
              disabled={replayingAll || dlqWebhooks.length === 0}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${replayingAll ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">{replayingAll ? 'Replaying All...' : `Replay All DLQ (${dlqWebhooks.length})`}</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* DLQ Status Table */}
        <div className="rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              
              <thead className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 font-mono uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Webhook ID</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Event Type</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Target URL</th>
                  <th className="py-3.5 px-4 font-semibold text-center whitespace-nowrap">Attempts</th>
                  <th className="py-3.5 px-4 font-semibold text-center whitespace-nowrap">Replays</th>
                  <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Dead Since</th>
                  <th className="py-3.5 px-4 font-semibold text-center whitespace-nowrap">Replay / Inspect</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {loading && dlqWebhooks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 animate-pulse">
                      Checking Dead Letter Queue status...
                    </td>
                  </tr>
                ) : dlqWebhooks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                        </div>
                        <h4 className="font-bold text-base text-slate-200 whitespace-nowrap">Dead Letter Queue is Empty!</h4>
                        <p className="text-xs text-slate-500 max-w-sm">
                          All webhooks are being delivered successfully or managed by exponential jitter retries.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  dlqWebhooks.map((w) => {
                    const targetUrl = w.target_url || w.targetUrl;
                    const eventType = w.event_type || w.eventType;
                    const attemptCount = w.attempt_count ?? w.attemptCount ?? 0;
                    const maxAttempts = w.max_attempts ?? w.maxAttempts ?? 5;
                    const replayCount = w.replay_count ?? w.replayCount ?? 0;

                    return (
                      <tr
                        key={w.id}
                        onClick={() => setSelectedWebhook(w)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        {/* ID */}
                        <td className="py-3.5 px-4 font-bold text-rose-400 group-hover:underline whitespace-nowrap">
                          {w.id.slice(0, 8)}...
                        </td>

                        {/* Event Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-[11px] whitespace-nowrap">
                            {eventType}
                          </span>
                        </td>

                        {/* Target URL */}
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-400 whitespace-nowrap">
                          {targetUrl}
                        </td>

                        {/* Attempts */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="text-rose-400 font-bold">{attemptCount}</span> / {maxAttempts}
                        </td>

                        {/* Replays */}
                        <td className="py-3.5 px-4 text-center text-slate-400 whitespace-nowrap">
                          {replayCount > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/50 text-purple-300 font-bold whitespace-nowrap">
                              x{replayCount}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 text-right text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(w.createdAt || w.created_at || Date.now()).toLocaleTimeString()}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaySingle(w.id);
                              }}
                              disabled={replayingId === w.id}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 transition-all whitespace-nowrap"
                            >
                              <Play className={`w-3 h-3 shrink-0 ${replayingId === w.id ? 'animate-spin' : ''}`} />
                              <span className="whitespace-nowrap">Replay</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWebhook(w);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                              title="Inspect Payload"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          </div>
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

      {/* Webhook Inspector Drawer */}
      <WebhookDrawer
        webhook={selectedWebhook}
        onClose={() => setSelectedWebhook(null)}
        onRefresh={() => loadDlq(false)}
      />
    </div>
  );
}
