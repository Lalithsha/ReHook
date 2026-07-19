import './globals.css';
import React from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, Cpu, Skull, RefreshCw, Key } from 'lucide-react';

export const metadata = {
  title: 'ReHook Dashboard | Webhook Delivery Engine',
  description: 'Enterprise Webhook Delivery Platform Operator Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col min-h-screen">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-50 glass-nav">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              {/* Brand Logo */}
              <Link href="/" className="flex items-center gap-3 group">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                  <RefreshCw className="w-5 h-5 text-white animate-spin-slow" />
                </div>
                <div>
                  <span className="font-extrabold text-xl tracking-tight gradient-text">
                    ReHook
                  </span>
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Engine v1.0
                  </span>
                </div>
              </Link>

              {/* Navigation Links */}
              <nav className="flex items-center gap-2">
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800/60 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Live Webhooks
                </Link>
                <Link
                  href="/dlq"
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800/60 text-slate-300 hover:text-rose-400 transition-colors flex items-center gap-2"
                >
                  <Skull className="w-4 h-4 text-rose-400" />
                  Dead Letter Queue (DLQ)
                </Link>
                <a
                  href="http://localhost:3001/api/v1/metrics"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800/60 text-slate-300 hover:text-purple-400 transition-colors flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Prometheus Metrics
                </a>
              </nav>

              {/* API Key Indicator */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Key: <code className="text-slate-200">super_secret_...</code></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Engine Online
                </div>
              </div>
            </div>
          </header>

          {/* Main Page Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/50 py-6 text-center text-xs text-slate-500">
            ReHook Webhook Delivery Engine © 2026 • Powered by Bun, Express, BullMQ, Redis & PostgreSQL
          </footer>
        </div>
      </body>
    </html>
  );
}
