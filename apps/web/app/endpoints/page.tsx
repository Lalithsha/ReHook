'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import HMACValidatorCard from '@/components/HMACValidatorCard';
import { WebhookEndpoint, fetchEndpoints, createEndpoint, rotateEndpointSecret } from '@/lib/api';
import { KeyRound, RefreshCw, Plus, Copy, Check, Lock, Sparkles, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Endpoint Registration Form State
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Secret Rotation State
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [copiedSecretMap, setCopiedSecretMap] = useState<Record<string, boolean>>({});

  const loadEndpoints = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await fetchEndpoints('default');
      setEndpoints(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load endpoint secrets');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadEndpoints(true);
  }, []);

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetUrl) return;
    try {
      setCreating(true);
      const ep = await createEndpoint(newTargetUrl, 'default');
      toast.success('Webhook endpoint registered with secret key!');
      setNewTargetUrl('');
      setIsRegisterOpen(false);
      loadEndpoints(true);
    } catch (err: any) {
      toast.error('Failed to create endpoint: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRotateSecret = async (endpointId: string) => {
    try {
      setRotatingId(endpointId);
      const updatedEp = await rotateEndpointSecret(endpointId);
      toast.success('Secret rotated successfully! Dual v1 and v2 signatures active.');
      loadEndpoints(false);
    } catch (err: any) {
      toast.error('Secret rotation failed: ' + err.message);
    } finally {
      setRotatingId(null);
    }
  };

  const copySecret = (secret: string, key: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecretMap((prev) => ({ ...prev, [key]: true }));
    toast.success('Secret key copied to clipboard');
    setTimeout(() => {
      setCopiedSecretMap((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6 text-amber-400 shrink-0" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2 whitespace-nowrap">
                <span>Endpoint Secret Manager & Dual-Secret Rotation</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Zero-downtime secret key rotation with dual HMAC-SHA256 signature support (<code className="text-amber-400 font-mono">v1</code> & <code className="text-amber-400 font-mono">v2</code>).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => loadEndpoints(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 flex items-center gap-2 transition-all whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">Refresh</span>
            </button>
            <button
              onClick={() => setIsRegisterOpen(!isRegisterOpen)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Register Endpoint</span>
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

        {/* Register Endpoint Form Drawer / Collapsible */}
        {isRegisterOpen && (
          <form
            onSubmit={handleCreateEndpoint}
            className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl animate-in fade-in"
          >
            <h3 className="font-bold text-sm text-white flex items-center gap-2 whitespace-nowrap">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Register New Webhook Endpoint Secret</span>
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                required
                value={newTargetUrl}
                onChange={(e) => setNewTargetUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 font-mono whitespace-nowrap shrink-0"
              >
                <span className="whitespace-nowrap">{creating ? 'Registering...' : 'Save & Generate Key'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Registered Endpoints Grid */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Active Endpoint Credentials ({endpoints.length})
          </h2>

          {loading && endpoints.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500 animate-pulse bg-slate-900/50 rounded-2xl border border-slate-800">
              Fetching registered endpoint credentials...
            </div>
          ) : endpoints.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400 space-y-3">
              <p>No endpoints registered yet under default project.</p>
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold whitespace-nowrap"
              >
                Register Your First Endpoint
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {endpoints.map((ep) => {
                const targetUrl = ep.target_url || ep.targetUrl;
                const secretV1 = ep.secret_v1 || ep.secretV1;
                const secretV2 = ep.secret_v2 || ep.secretV2;
                const hasV2 = Boolean(secretV2);

                return (
                  <div
                    key={ep.id}
                    className="p-5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800 space-y-4 shadow-xl"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block whitespace-nowrap">Target Endpoint URL</span>
                        <div className="font-mono text-sm font-bold text-white flex items-center gap-2 break-all">
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {targetUrl}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        {hasV2 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800/60 whitespace-nowrap">
                            Dual Secret Rotation Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 whitespace-nowrap">
                            Single Secret Active
                          </span>
                        )}

                        <button
                          onClick={() => handleRotateSecret(ep.id)}
                          disabled={rotatingId === ep.id}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-mono text-amber-300 border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
                        >
                          <RefreshCw className={`w-3 h-3 shrink-0 ${rotatingId === ep.id ? 'animate-spin' : ''}`} />
                          <span className="whitespace-nowrap">{rotatingId === ep.id ? 'Rotating Secret...' : 'Rotate Secret'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Keys Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      
                      {/* Secret V1 */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                          <span className="whitespace-nowrap">Secret Key (V1)</span>
                          <button
                            onClick={() => copySecret(secretV1, `${ep.id}-v1`)}
                            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 whitespace-nowrap"
                          >
                            {copiedSecretMap[`${ep.id}-v1`] ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                            <span className="whitespace-nowrap">{copiedSecretMap[`${ep.id}-v1`] ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="text-amber-300 font-bold break-all select-all">
                          {secretV1}
                        </div>
                      </div>

                      {/* Secret V2 (If Rotated) */}
                      <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                        hasV2 ? 'bg-amber-950/20 border-amber-800/60' : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                          <span className="whitespace-nowrap">Secret Key (V2 Rotated)</span>
                          {hasV2 && (
                            <button
                              onClick={() => copySecret(secretV2!, `${ep.id}-v2`)}
                              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 whitespace-nowrap"
                            >
                              {copiedSecretMap[`${ep.id}-v2`] ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                              <span className="whitespace-nowrap">{copiedSecretMap[`${ep.id}-v2`] ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                        </div>
                        <div className="text-slate-300 font-bold break-all select-all">
                          {hasV2 ? secretV2 : 'No rotation pending (Click "Rotate Secret" to issue v2 key)'}
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive HMAC Signature Validator Sandbox */}
        <HMACValidatorCard />

      </main>
    </div>
  );
}
