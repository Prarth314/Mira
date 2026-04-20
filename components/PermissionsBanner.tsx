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
    <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center text-amber-200 text-[12px]">
      <span className="font-medium">Permissions needed</span>
      {!micOk && (
        <button
          onClick={() =>
            report.microphone === 'not-determined' || report.microphone === 'unknown'
              ? onRequestMic()
              : onOpenSettings('mic')
          }
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30"
        >
          <Mic size={12} /> Microphone ({report.microphone})
        </button>
      )}
      {!screenOk && (
        <button
          onClick={() => onOpenSettings('screen')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30"
        >
          <Monitor size={12} /> Screen Recording ({report.screen})
        </button>
      )}
    </div>
  );
};

export default PermissionsBanner;
