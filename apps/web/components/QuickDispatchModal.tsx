'use client';

import React, { useState } from 'react';
import { X, Send, Sparkles, Check, AlertCircle, Terminal, HelpCircle } from 'lucide-react';
import { dispatchWebhook } from '@/lib/api';
import { toast } from 'sonner';

interface QuickDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_PAYLOADS = {
  'order.completed': {
    order_id: 'ORD-98421',
    amount: 149.99,
    currency: 'USD',
    customer: { id: 'usr_771', email: 'alex@example.com' },
    status: 'paid',
  },
  'payment.failed': {
    transaction_id: 'tx_88102',
    reason: 'card_declined',
    attempt: 2,
    customer_id: 'usr_771',
  },
  'user.created': {
    user_id: 'usr_9910',
    email: 'newuser@rehook.dev',
    role: 'developer',
  },
};

export default function QuickDispatchModal({ isOpen, onClose, onSuccess }: QuickDispatchModalProps) {
  const [targetUrl, setTargetUrl] = useState('https://httpbin.org/post');
  const [eventType, setEventType] = useState('order.completed');
  const [payloadText, setPayloadText] = useState(JSON.stringify(PRESET_PAYLOADS['order.completed'], null, 2));
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (type: keyof typeof PRESET_PAYLOADS) => {
    setEventType(type);
    setPayloadText(JSON.stringify(PRESET_PAYLOADS[type], null, 2));
    setJsonError(null);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch (err: any) {
      setJsonError('Invalid JSON format in payload field');
      return;
    }

    try {
      setSubmitting(true);
      const res = await dispatchWebhook({
        target_url: targetUrl,
        event_type: eventType,
        payload: parsedPayload,
        retry_config: {
          max_attempts: maxAttempts,
          initial_delay_ms: 2000,
        },
      });

      toast.success(`Webhook Dispatched! ID: ${res.webhook_id.slice(0, 8)}...`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Dispatch Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#090D16] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center">
              <Send className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Dispatch Test Webhook</h3>
              <p className="text-xs text-slate-400">Enqueue a new webhook event into ReHook delivery engine</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDispatch} className="p-6 space-y-4">
          
          {/* Target URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider block">
              Target Endpoint URL
            </label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://your-api.com/webhooks"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
            {/* Quick URL Helpers */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-500 font-mono">Presets:</span>
              <button
                type="button"
                onClick={() => setTargetUrl('https://httpbin.org/post')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-sky-400 hover:bg-slate-800"
              >
                httpbin 200 OK
              </button>
              <button
                type="button"
                onClick={() => setTargetUrl('https://httpbin.org/status/500')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-rose-400 hover:bg-slate-800"
              >
                httpbin 500 ERR (Test Retry/DLQ)
              </button>
            </div>
          </div>

          {/* Event Type & Max Attempts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider block">
                Event Type
              </label>
              <input
                type="text"
                required
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="order.completed"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider block">
                Max Retries
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10) || 5)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300 focus:outline-none focus:border-sky-500 transition-all text-center"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Payload Presets:</span>
            {Object.keys(PRESET_PAYLOADS).map((presetKey) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => handleSelectPreset(presetKey as keyof typeof PRESET_PAYLOADS)}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 transition-all"
              >
                {presetKey}
              </button>
            ))}
          </div>

          {/* JSON Payload Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider block">
                JSON Payload Body
              </label>
              {jsonError && <span className="text-[11px] font-mono text-rose-400 font-semibold">{jsonError}</span>}
            </div>
            <textarea
              rows={6}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-[#060911] border border-slate-800 text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-500 leading-relaxed shadow-inner"
            />
          </div>

          {/* Footer Submit Actions */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Send className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
              {submitting ? 'Dispatching...' : 'Dispatch Webhook Event'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
