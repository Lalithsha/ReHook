'use client';

import React from 'react';
import { Layers, CheckCircle2, Clock, Skull } from 'lucide-react';

interface MetricsCardsProps {
  total: number;
  delivered: number;
  retrying: number;
  dead: number;
  loading?: boolean;
}

export default function MetricsCards({ total, delivered, retrying, dead, loading }: MetricsCardsProps) {
  const successRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '100.0';

  const cards = [
    {
      title: 'Total Ingested',
      value: total.toLocaleString(),
      subtitle: 'Async events dispatched',
      icon: Layers,
      color: 'text-sky-400',
      iconBg: 'bg-sky-950/70 border-sky-500/40 text-sky-400',
      badge: 'BullMQ Engine',
      badgeStyle: 'bg-sky-950/60 text-sky-300 border-sky-500/30',
      glow: 'group-hover:shadow-sky-500/10',
    },
    {
      title: 'Delivery Rate',
      value: `${successRate}%`,
      subtitle: `${delivered.toLocaleString()} successful dispatches`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      iconBg: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400',
      badge: 'Zero-Loss',
      badgeStyle: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
      glow: 'group-hover:shadow-emerald-500/10',
    },
    {
      title: 'In Flight / Retrying',
      value: retrying.toLocaleString(),
      subtitle: 'Exponential jitter backoff',
      icon: Clock,
      color: 'text-amber-400',
      iconBg: 'bg-amber-950/70 border-amber-500/40 text-amber-400',
      badge: retrying > 0 ? 'Active Queue' : 'Idle',
      badgeStyle: retrying > 0 ? 'bg-amber-950/70 text-amber-300 border-amber-500/40' : 'bg-slate-900 text-slate-400 border-slate-800',
      glow: 'group-hover:shadow-amber-500/10',
    },
    {
      title: 'Dead Letter Queue',
      value: dead.toLocaleString(),
      subtitle: 'Exhausted retry budget',
      icon: Skull,
      color: dead > 0 ? 'text-rose-400' : 'text-slate-400',
      iconBg: dead > 0 ? 'bg-rose-950/70 border-rose-500/40 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-400',
      badge: dead > 0 ? 'Action Needed' : 'Clean',
      badgeStyle: dead > 0 ? 'bg-rose-950/70 text-rose-300 border-rose-500/40' : 'bg-slate-900 text-slate-400 border-slate-800',
      glow: 'group-hover:shadow-rose-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`group relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-5 hover:border-slate-700/90 transition-all duration-300 shadow-xl ${card.glow}`}
          >
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent group-hover:via-sky-500/50 transition-all duration-300" />

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                {card.title}
              </span>
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200 shadow-sm`}>
                <Icon className={`w-5 h-5 ${card.color} shrink-0`} />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-2">
              <div className="text-3xl font-heading font-extrabold text-white tracking-tight whitespace-nowrap">
                {loading ? <span className="animate-pulse opacity-50 font-mono">...</span> : card.value}
              </div>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${card.badgeStyle}`}>
                {card.badge}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-slate-400 font-medium whitespace-nowrap">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
