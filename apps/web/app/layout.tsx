import './globals.css';
import React from 'react';
import Link from 'next/link';
import { Activity, Skull, Cpu, RefreshCw, Key, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'ReHook Platform | Webhook Engine Portal',
  description: 'Enterprise Webhook Delivery Engine Operator Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="flex flex-col min-h-screen">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-50 glass-nav border-b border-slate-800/80">
            <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
              
              {/* Brand Logo & Version */}
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-all duration-200">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xl tracking-tight text-white">
                      ReHook
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sky-950/80 border border-sky-800/60 text-[10px] font-bold text-sky-400 uppercase tracking-wide">
                      Engine v1.0
                    </span>
                  </div>
                </Link>

                {/* Navigation Tab Links */}
                <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
                  <Link
                    href="/"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/60 transition-all flex items-center gap-2"
                  >
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    Live Webhooks
                  </Link>
                  <Link
                    href="/dlq"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all flex items-center gap-2"
                  >
                    <Skull className="w-3.5 h-3.5 text-rose-400" />
                    Dead Letter Queue (DLQ)
                  </Link>
                  <a
                    href="http://localhost:3001/api/v1/metrics"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/30 transition-all flex items-center gap-2"
                  >
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    Prometheus Metrics
                  </a>
                </nav>
              </div>

              {/* API Key Status Badge */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-400">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>API Key: <code className="text-slate-200 font-bold">super_secret_...</code></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-xs font-semibold text-emerald-400 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Engine Online
                </div>
              </div>

            </div>
          </header>

          {/* Main Workspace Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/60 py-6 text-center text-xs font-medium text-slate-500">
            ReHook Webhook Delivery Platform © 2026 • High-Throughput Fault-Tolerant Engine
          </footer>
        </div>
      </body>
    </html>
  );
}
