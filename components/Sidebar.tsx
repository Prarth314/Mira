
import React, { useRef, useEffect, useState } from 'react';
import { CommandLog } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Database, Terminal, Cpu, HardDrive, ShieldCheck, Layers } from 'lucide-react';

interface SidebarProps {
  logs: CommandLog[];
}

const Sidebar: React.FC<SidebarProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState({ cpu: 0, mem: 0 });

  // BACKEND LOGIC PRESERVED (UNCHANGED)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry({
        cpu: Math.floor(Math.random() * 8) + 1,
        mem: 12.4 + (Math.random() * 0.2)
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="flex-1 flex flex-col gap-8 h-full p-0 bg-transparent text-slate-200">
      
      {/* SECTION 1: SYSTEM TELEMETRY MODULE */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative group bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-10 shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-white/10 transition-all duration-700 hover:border-cyan-500/30"
      >
        <div className="absolute inset-0 bg-cyan-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
              <Activity size={20} className="text-cyan-400" />
            </div>
            <span className="text-[13px] font-black uppercase tracking-[0.5em] text-cyan-400/90 font-mono">Neural Telemetry</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_#10b981]" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] font-mono">SECURE_LINK</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 relative z-10">
          {/* CPU Card */}
          <div className="relative p-8 rounded-[2.5rem] bg-slate-950/40 border border-white/5 overflow-hidden group/item shadow-inner">
            <div className="flex items-center gap-3 mb-6 text-slate-500">
              <Cpu size={16} className="group-hover/item:text-cyan-400 transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] font-mono">Cortex Load</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black font-mono text-white tracking-tighter tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">{telemetry.cpu}</span>
              <span className="text-[12px] font-black text-cyan-500/60 uppercase tracking-widest font-mono">%</span>
            </div>
            {/* Segmented Block Progress Bar */}
            <div className="mt-8 h-4 w-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 flex gap-[3px] p-1">
              {[...Array(12)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ opacity: (telemetry.cpu * 0.12) >= (i / 12) * 12 ? 1 : 0.1 }}
                  className="flex-1 h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] rounded-sm"
                />
              ))}
            </div>
          </div>

          {/* MEMORY Card */}
          <div className="relative p-8 rounded-[2.5rem] bg-slate-950/40 border border-white/5 group/item shadow-inner">
            <div className="flex items-center gap-3 mb-6 text-slate-500">
              <HardDrive size={16} className="group-hover/item:text-cyan-400 transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] font-mono">Neural Buffer</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black font-mono text-white tracking-tighter tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">{telemetry.mem.toFixed(1)}</span>
              <span className="text-[12px] font-black text-cyan-500/60 uppercase tracking-widest font-mono">GB</span>
            </div>
            {/* Segmented Block Progress Bar */}
            <div className="mt-8 h-4 w-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 flex gap-[3px] p-1">
              {[...Array(12)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ opacity: (telemetry.mem / 16) >= (i / 12) ? 1 : 0.1 }}
                  className="flex-1 h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] rounded-sm"
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* SECTION 2: INTERACTION JOURNAL */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="flex-1 relative flex flex-col bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-white/10"
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-slate-500/10 rounded-2xl border border-white/10 shadow-inner">
              <Terminal size={20} className="text-slate-400" />
            </div>
            <span className="text-[13px] font-black uppercase tracking-[0.5em] text-slate-400 font-mono">Activity Ledger</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-2xl border border-white/5">
            <ShieldCheck size={20} className="text-slate-800" />
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div 
            ref={scrollRef}
            className="h-full overflow-y-auto space-y-6 pr-4 custom-scrollbar"
            style={{ maskImage: 'linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)' }}
          >
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-800 space-y-8">
                <div className="p-8 bg-white/[0.02] rounded-full ring-1 ring-white/5 animate-pulse">
                  <Database size={80} strokeWidth={0.3} className="opacity-10" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.8em] opacity-30 text-center font-mono">NODE_SEARCHING...</p>
              </div>
            )}
            
            <AnimatePresence mode="popLayout">
              {logs.map((log, i) => (
                <motion.div 
                  key={i + log.timestamp.getTime()}
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`group p-8 rounded-[2.5rem] border transition-all duration-500 ${
                    log.type === 'ai' 
                      ? 'bg-cyan-500/5 border-cyan-500/30 shadow-[0_15px_40px_rgba(34,211,238,0.08)]' 
                      : 'bg-white/[0.03] border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase tracking-[0.4em] px-4 py-2 rounded-xl font-mono ${
                        log.type === 'ai' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {log.type === 'ai' ? 'ACTUATOR_CORE' : log.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600 font-bold tracking-widest tabular-nums bg-slate-950/50 px-3 py-1 rounded-lg border border-white/5">
                      {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-[14px] leading-relaxed font-bold tracking-tight font-mono ${
                    log.type === 'ai' ? 'text-cyan-100/90' : 'text-slate-400/80'
                  }`}>
                    {log.message}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* CYBERNETIC FOOTER */}
        <div className="mt-10 pt-8 border-t border-white/10 flex items-center justify-between opacity-30 px-2 font-mono">
          <div className="flex gap-10">
            <div className="flex items-center gap-3">
              <Layers size={12} />
              <span className="text-[10px] font-black tracking-[0.3em] uppercase">AES-256_KERNEL_v11</span>
            </div>
            <span className="text-[10px] font-black tracking-[0.3em] uppercase">SECURE_BRIDGE_ACTIVE</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">BUILD_0x8F_SECURE</span>
        </div>
      </motion.div>
    </aside>
  );
};

export default Sidebar;
