'use client';

import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Lock, Terminal, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function HMACValidatorCard() {
  const [secret, setSecret] = useState('rehook_sec_live_99812401');
  const [payloadText, setPayloadText] = useState('{\n  "event": "order.completed",\n  "amount": 2999.00\n}');
  const [signature, setSignature] = useState('');
  const [copied, setCopied] = useState(false);

  const calculateHmac = async () => {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const msgData = encoder.encode(payloadText);

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const hexSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      setSignature(hexSignature);
      toast.success('HMAC SHA-256 signature calculated!');
    } catch (err: any) {
      toast.error('Failed to compute signature: ' + err.message);
    }
  };

  const handleCopySignature = () => {
    if (!signature) return;
    navigator.clipboard.writeText(`sha256=${signature}`);
    setCopied(true);
    toast.success('X-ReHook-Signature copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800 p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">HMAC SHA-256 Signature Validator Sandbox</h3>
            <p className="text-xs text-slate-400">Compute & verify the exact <code className="text-emerald-400 font-mono">X-ReHook-Signature</code> header generated during webhook dispatch</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Signing Secret */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider block">
            Signing Secret Key
          </label>
          <div className="relative">
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300 focus:outline-none focus:border-emerald-500 transition-all pr-8"
            />
            <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3" />
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-end">
          <button
            onClick={calculateHmac}
            className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Compute X-ReHook-Signature
          </button>
        </div>
      </div>

      {/* Payload Textarea */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider block">
          Raw Request Body Text
        </label>
        <textarea
          rows={3}
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          className="w-full p-3 rounded-xl bg-[#060911] border border-slate-800 text-xs font-mono text-sky-300 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Signature Result */}
      {signature && (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-semibold">
            <span>X-ReHook-Signature Header Output:</span>
            <button
              onClick={handleCopySignature}
              className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-xs flex items-center gap-1.5 border border-emerald-700/60 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Header' : 'Copy Header'}
            </button>
          </div>
          <div className="p-3 rounded-lg bg-black/60 font-mono text-xs text-emerald-300 break-all select-all border border-emerald-900/40">
            sha256={signature}
          </div>
        </div>
      )}
    </div>
  );
}
