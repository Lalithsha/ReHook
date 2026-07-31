'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Skull, Key, RefreshCw, Radio, KeyRound } from 'lucide-react';

interface NavbarProps {
  autoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
  lastUpdated?: Date | null;
}

export default function Navbar({ autoRefresh, onToggleAutoRefresh, lastUpdated }: NavbarProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Live Webhooks', icon: Activity, badge: null },
    { href: '/dlq', label: 'Dead Letter Queue', icon: Skull, badge: 'DLQ' },
    { href: '/endpoints', label: 'Endpoints & Secrets', icon: KeyRound, badge: null },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#05070E]/85 backdrop-blur-2xl border-b border-slate-800/70 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        
        {/* Brand & Links */}
        <div className="flex items-center gap-6 lg:gap-8 shrink-0">
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-all duration-300 ring-1 ring-white/20">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-heading font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-sky-100 to-slate-300 bg-clip-text text-transparent drop-shadow-sm">
                ReHook
              </span>
              <span className="px-2 py-0.5 rounded-md bg-sky-950/80 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300 uppercase tracking-wider shadow-sm">
                v1.0
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-slate-800 to-slate-800/90 text-white shadow-md border border-slate-700/80 shadow-sky-500/5'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{link.label}</span>
                  {link.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-950/90 text-rose-400 border border-rose-500/40 whitespace-nowrap shadow-sm">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          
          {/* Live Auto-Refresh Pulse Button */}
          {onToggleAutoRefresh && (
            <button
              onClick={onToggleAutoRefresh}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all whitespace-nowrap ${
                autoRefresh
                  ? 'bg-sky-950/60 border-sky-500/40 text-sky-300 hover:bg-sky-900/60 shadow-sm shadow-sky-500/10'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:bg-slate-800/70'
              }`}
              title="Toggle 3s Auto-Refresh"
            >
              <Radio className={`w-4 h-4 shrink-0 ${autoRefresh ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="hidden sm:inline whitespace-nowrap font-mono">{autoRefresh ? 'Live Stream On' : 'Paused'}</span>
            </button>
          )}

          {/* API Key Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs font-mono text-amber-300 whitespace-nowrap shadow-sm">
            <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="whitespace-nowrap">API: <code className="text-amber-200 font-bold">super_secret_...</code></span>
          </div>

          {/* Engine Status Indicator */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-xs font-bold text-emerald-400 whitespace-nowrap shadow-sm shadow-emerald-500/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_#34d399]"></span>
            <span className="whitespace-nowrap"><span className="hidden sm:inline">Engine</span> Online</span>
          </div>
        </div>

      </div>
    </header>
  );
}
