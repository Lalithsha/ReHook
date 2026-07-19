'use client';

import React, { useState, useEffect } from 'react';
import { Skull, RefreshCw, AlertOctagon, RotateCcw, CheckCircle, ExternalLink } from 'lucide-react';

interface DeadWebhook {
  id: string;
  targetUrl: string;
  eventType: string;
  payload: any;
  status: string;
  maxAttempts: number;
  attemptCount: number;
  replayCount: number;
  createdAt: string;
  attempts?: Array<{
    errorMessage?: string;
    statusCode?: number;
    responseTimeMs?: number;
  }>;
}

export default function DeadLetterQueuePage() {
  const [deadWebhooks, setDeadWebhooks] = useState<DeadWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchDLQ = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3001/api/v1/dlq?limit=50', {
        headers: {
          'x-api-key': 'super_secret_rehook_key_123',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setDeadWebhooks(data.webhooks || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch DLQ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDLQ();
  }, []);

  const handleReplay = async (id: string) => {
    setReplayingId(id);
    try {
      const res = await fetch(`http://localhost:3001/api/v1/dlq/${id}/replay`, {
        method: 'POST',
        headers: {
          'x-api-key': 'super_secret_rehook_key_123',
        },
      });

      const data = await res.json();
      if (res.ok) {
        setToastMessage(`✅ Replay Triggered for Webhook ${id}! Replay Count: ${data.replay_count}`);
        fetchDLQ();
      } else {
        setToastMessage(`❌ Replay Failed: ${data.message}`);
      }
    } catch (err: any) {
      setToastMessage(`❌ Network Error: ${err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <div className="space-y-8">

      {/* Page Title Header */}
      <div className="flex items-center justify-between glass-panel p-6 border-l-4 border-l-rose-500">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-rose-400 flex items-center gap-3">
            <Skull className="w-6 h-6 text-rose-500" />
            Dead Letter Queue (DLQ) Inspector
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Webhooks that exhausted maximum retry attempts. Inspect failure traces and trigger manual replays.
          </p>
        </div>
        <button
          onClick={fetchDLQ}
          className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 border border-slate-700/80 flex items-center gap-2 transition-all shadow-sm active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-rose-400 ${loading ? 'animate-spin' : ''}`} />
          Refresh DLQ
        </button>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-slate-900 border border-sky-800 text-xs font-mono text-sky-300 flex items-center justify-between shadow-lg">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-500 hover:text-white font-bold px-2 py-1">✕</button>
        </div>
      )}

      {/* Dead Webhooks List Container */}
      <div className="glass-panel overflow-hidden">
        
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="font-bold text-white text-base">Dead-Lettered Webhook Jobs</h3>
          <span className="text-xs px-3 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold font-mono">
            {deadWebhooks.length} Jobs Exhausted
          </span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {deadWebhooks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-slate-200 font-bold text-base">No dead-lettered webhooks in DLQ!</p>
              <p className="text-xs text-slate-400">All webhook deliveries are processing normally without unhandled failures.</p>
            </div>
          ) : (
            deadWebhooks.map((job) => (
              <div key={job.id} className="p-6 hover:bg-slate-800/30 transition-colors space-y-4">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-md bg-rose-950/80 border border-rose-800/60 text-xs font-mono text-rose-300 font-bold">
                        {job.eventType}
                      </span>
                      <span className="text-xs font-mono text-slate-400">ID: {job.id}</span>
                      {job.replayCount > 0 && (
                        <span className="text-xs px-2.5 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/80 font-bold font-mono">
                          Replayed {job.replayCount}x
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-mono text-slate-200 flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      {job.targetUrl}
                    </div>
                  </div>

                  <button
                    onClick={() => handleReplay(job.id)}
                    disabled={replayingId === job.id}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold text-xs text-white shadow-lg shadow-indigo-500/20 flex items-center gap-2 self-start md:self-auto transition-all active:scale-95 disabled:opacity-50"
                  >
                    {replayingId === job.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Replay Webhook
                  </button>
                </div>

                {/* Error Trace Snippet */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono text-rose-300 flex items-start gap-2.5">
                  <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 font-semibold">Failure Root Cause: </span>
                    {job.attempts?.[0]?.errorMessage || 'Exhausted max retry attempts without receiving HTTP 2xx success response.'}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
}
