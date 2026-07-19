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
      setToastMessage(`❌ Replay Network Error: ${err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex items-center justify-between glass-card p-6 border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-rose-400 flex items-center gap-3">
            <Skull className="w-7 h-7 text-rose-500" />
            Dead Letter Queue (DLQ) Inspector
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Jobs that exhausted maximum retry attempts. Inspect root causes and trigger manual operator replays.
          </p>
        </div>
        <button
          onClick={fetchDLQ}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh DLQ
        </button>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-lg bg-slate-900 border border-cyan-800 text-xs font-mono text-cyan-300 flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Dead Webhooks List */}
      <div className="glass-card border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-base">Dead-Lettered Webhook Jobs</h3>
          <span className="text-xs px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
            {deadWebhooks.length} Jobs Exhausted
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {deadWebhooks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">No dead-lettered jobs in DLQ!</p>
              <p className="text-xs text-slate-500 mt-1">All webhook deliveries are operating normally.</p>
            </div>
          ) : (
            deadWebhooks.map((job) => (
              <div key={job.id} className="p-6 hover:bg-slate-800/30 transition-colors space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-rose-300 font-semibold">
                        {job.eventType}
                      </span>
                      <span className="text-xs font-mono text-slate-400">ID: {job.id}</span>
                      {job.replayCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
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
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-semibold text-xs text-white shadow-md shadow-purple-500/20 flex items-center gap-2 self-start md:self-auto transition-all"
                  >
                    {replayingId === job.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Replay Webhook
                  </button>
                </div>

                {/* Error Trace & Payload Details */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-rose-300 flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 font-semibold">Failure Cause: </span>
                    {job.attempts?.[0]?.errorMessage || 'Max attempts reached without successful HTTP 2xx response.'}
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
