'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Play, Clock, ShieldAlert, Cpu, AlertTriangle, Layers, ExternalLink, Code2 } from 'lucide-react';
import { WebhookJob, WebhookAttempt, fetchWebhookAttempts, replayDlqWebhook } from '@/lib/api';
import { toast } from 'sonner';

interface WebhookDrawerProps {
  webhook: WebhookJob | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function WebhookDrawer({ webhook, onClose, onRefresh }: WebhookDrawerProps) {
  const [activeTab, setActiveTab] = useState<'payload' | 'attempts'>('payload');
  const [attempts, setAttempts] = useState<WebhookAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    if (webhook) {
      loadAttempts(webhook.id);
    }
  }, [webhook]);

  const loadAttempts = async (id: string) => {
    try {
      setLoadingAttempts(true);
      const data = await fetchWebhookAttempts(id);
      setAttempts(data);
    } catch (err: any) {
      console.error('Failed to load attempts:', err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  if (!webhook) return null;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(webhook.payload, null, 2));
    setCopiedPayload(true);
    toast.success('JSON Payload copied to clipboard');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(webhook.id);
    setCopiedId(true);
    toast.success('Webhook ID copied');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleReplay = async () => {
    try {
      setReplaying(true);
      await replayDlqWebhook(webhook.id);
      toast.success(`Webhook ${webhook.id.slice(0, 8)}... replayed successfully!`);
      if (onRefresh) onRefresh();
      loadAttempts(webhook.id);
    } catch (err: any) {
      toast.error(`Replay failed: ${err.message}`);
    } finally {
      setReplaying(false);
    }
  };

  const targetUrl = webhook.target_url || webhook.targetUrl;
  const eventType = webhook.event_type || webhook.eventType;
  const attemptCount = webhook.attempt_count ?? webhook.attemptCount ?? 0;
  const maxAttempts = webhook.max_attempts ?? webhook.maxAttempts ?? 5;
  const replayCount = webhook.replay_count ?? webhook.replayCount ?? 0;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60';
      case 'retrying':
      case 'processing':
      case 'pending':
        return 'bg-sky-950/80 text-sky-400 border-sky-800/60';
      case 'dead':
      case 'failed':
        return 'bg-rose-950/80 text-rose-400 border-rose-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity animate-in fade-in duration-200">
      
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-[#090D16] border-l border-slate-800 h-full shadow-2xl flex flex-col z-10">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-start justify-between gap-4 bg-slate-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border uppercase tracking-wider ${getStatusBadge(webhook.status)}`}>
                {webhook.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-800/60 text-xs font-mono text-indigo-300 font-semibold">
                {eventType}
              </span>
              {replayCount > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 border border-purple-800/50 text-purple-300">
                  Replayed x{replayCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <h2 className="text-lg font-bold text-white font-mono truncate max-w-sm">
                {webhook.id}
              </h2>
              <button
                onClick={handleCopyId}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-all"
                title="Copy Webhook ID"
              >
                {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Summary Cards */}
        <div className="p-6 border-b border-slate-800/60 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/40 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 col-span-2 sm:col-span-3">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Target Endpoint URL</span>
            <span className="text-slate-200 break-all flex items-center gap-1.5 font-semibold">
              <ExternalLink className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {targetUrl}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Attempts</span>
            <span className="text-slate-200 font-bold">{attemptCount} / {maxAttempts}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Created At</span>
            <span className="text-slate-300">{new Date(webhook.createdAt || webhook.created_at || Date.now()).toLocaleTimeString()}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Queue Status</span>
            <span className="text-slate-300 font-semibold capitalize">{webhook.status}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="px-6 py-3 border-b border-slate-800/60 flex items-center justify-between gap-3 bg-slate-900/30">
          {/* Tab Selection */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('payload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'payload'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              JSON Payload
            </button>
            <button
              onClick={() => setActiveTab('attempts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'attempts'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Attempt Logs ({attempts.length})
            </button>
          </div>

          {/* Replay Action Button (for dead / failed webhooks) */}
          {(webhook.status === 'dead' || webhook.status === 'failed') && (
            <button
              onClick={handleReplay}
              disabled={replaying}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
            >
              <Play className={`w-3.5 h-3.5 ${replaying ? 'animate-spin' : ''}`} />
              {replaying ? 'Replaying...' : 'Replay Webhook'}
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {activeTab === 'payload' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Request Payload (JSON)</span>
                <button
                  onClick={handleCopyPayload}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 border border-slate-700/60 transition-all"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPayload ? 'Copied' : 'Copy Payload'}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#060911] border border-slate-800 text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed shadow-inner">
                {JSON.stringify(webhook.payload, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'attempts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Delivery Attempt Timeline
                </span>
                <button
                  onClick={() => loadAttempts(webhook.id)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-mono"
                >
                  Refresh Logs
                </button>
              </div>

              {loadingAttempts ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500 animate-pulse">
                  Fetching attempt history...
                </div>
              ) : attempts.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                  No delivery attempts logged yet. Webhook is queued in BullMQ.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                  {attempts.map((attempt, index) => (
                    <div
                      key={attempt.id || index}
                      className="relative pl-8 p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2"
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 top-5 w-2.5 h-2.5 rounded-full border-2 bg-[#090D16] ${
                        attempt.statusCode && attempt.statusCode < 400 ? 'border-emerald-400 bg-emerald-400' : 'border-rose-400 bg-rose-400'
                      }`} />

                      <div className="flex items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">Attempt #{attempt.attemptNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            attempt.statusCode && attempt.statusCode < 400
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                              : 'bg-rose-950 text-rose-400 border-rose-800/60'
                          }`}>
                            HTTP {attempt.statusCode || 'ERR'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {attempt.responseTimeMs ?? attempt.executionTimeMs ?? 0}ms • <code className="text-slate-300">{attempt.executionStatus || attempt.circuitState || 'unknown'}</code>
                        </span>
                      </div>

                      {attempt.deliveryId && (
                        <div className="text-[10px] text-slate-400 font-mono break-all">
                          Delivery ID: <code className="text-sky-300">{attempt.deliveryId}</code>
                        </div>
                      )}

                      {attempt.errorMessage && (
                        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-mono break-all">
                          <span className="font-semibold block text-rose-400 text-[10px] uppercase">Error Details:</span>
                          {attempt.errorMessage}
                        </div>
                      )}

                      {attempt.responseBody && (
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-400 text-[11px] font-mono break-all max-h-32 overflow-y-auto">
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Response Body:</span>
                          {attempt.responseBody}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 font-mono text-right">
                        {new Date(attempt.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
