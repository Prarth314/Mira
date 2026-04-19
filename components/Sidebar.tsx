import React, { useRef, useEffect } from 'react';
import { CommandLog } from '../types';
import type { Telemetry } from '../src/types/window';

interface SidebarProps {
  logs: CommandLog[];
  telemetry: Telemetry | null;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

const Sidebar: React.FC<SidebarProps> = ({ logs, telemetry }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <aside className="flex flex-col h-full gap-4 text-zinc-300">
      <div className="flex-1 min-h-0 bg-zinc-900/50 border border-white/5 rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Activity</span>
          <span className="text-[11px] text-zinc-500">{logs.length} {logs.length === 1 ? 'event' : 'events'}</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 text-[12px] leading-snug">
          {logs.length === 0 ? (
            <div className="text-zinc-600 italic">No activity yet. Hold ⌥Space anywhere to talk, or type a command.</div>
          ) : (
            logs.map((log, i) => {
              const tone =
                log.type === 'user'
                  ? 'text-zinc-100'
                  : log.type === 'ai'
                  ? 'text-blue-300'
                  : 'text-zinc-500';
              return (
                <div key={i} className="flex gap-2">
                  <span className="text-zinc-700 font-mono shrink-0">{formatTime(log.timestamp)}</span>
                  <span className={`break-words ${tone}`}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 grid grid-cols-3 gap-4 text-[11px]">
        <Stat label="CPU" value={telemetry ? `${telemetry.cpuLoad.toFixed(0)}%` : '—'} />
        <Stat label="Memory" value={telemetry ? `${telemetry.memUsedGB.toFixed(1)} / ${telemetry.memTotalGB.toFixed(0)} GB` : '—'} />
        <Stat label="Battery" value={telemetry?.battery == null ? '—' : `${telemetry.battery}%`} />
      </div>
    </aside>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-zinc-500">{label}</span>
    <span className="text-zinc-200 font-medium tabular-nums">{value}</span>
  </div>
);

export default Sidebar;
