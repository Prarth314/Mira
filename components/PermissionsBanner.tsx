import React from 'react';
import type { PermissionsReport } from '../src/types/window';
import { Mic, Monitor } from 'lucide-react';

type Props = {
  report: PermissionsReport | null;
  onRequestMic: () => void;
  onOpenSettings: (what: 'mic' | 'screen') => void;
};

const PermissionsBanner: React.FC<Props> = ({ report, onRequestMic, onOpenSettings }) => {
  if (!report) return null;
  const micOk = report.microphone === 'granted';
  const screenOk = report.screen === 'granted';
  if (micOk && screenOk) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4 flex flex-wrap gap-3 items-center text-amber-200 text-xs font-mono">
      <span className="font-black uppercase tracking-widest">Setup needed</span>
      {!micOk && (
        <button
          onClick={() =>
            report.microphone === 'not-determined' || report.microphone === 'unknown'
              ? onRequestMic()
              : onOpenSettings('mic')
          }
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30"
        >
          <Mic size={14} /> Microphone ({report.microphone})
        </button>
      )}
      {!screenOk && (
        <button
          onClick={() => onOpenSettings('screen')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30"
        >
          <Monitor size={14} /> Screen Recording ({report.screen})
        </button>
      )}
    </div>
  );
};

export default PermissionsBanner;
