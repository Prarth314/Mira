import React, { useEffect } from 'react';
import { AudioLines, Loader2, Square, X, ArrowUpRight } from 'lucide-react';
import { useStudio } from '../../hooks/useStudio';
import AudioVisualizer from '../../components/AudioVisualizer';

const Overlay: React.FC = () => {
  const studio = useStudio();
  const { state, start, finish, cancel } = studio;
  useEffect(() => {
    const off = window.mira?.overlay.onShow(() => {
      void start('dictate');
    });
    const toggle = window.mira?.overlay.onToggle(() => {
      if (state.phase === 'recording') void finish();
      else if (state.phase === 'idle') void start('dictate');
    });
    void window.mira?.overlay.ready();
    return () => {
      off?.();
      toggle?.();
    };
  }, [start, finish, state.phase]);
  return (
    <div className="overlay-bar">
      <div className="overlay-symbol">
        {state.phase === 'transcribing' || state.phase === 'refining' ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <AudioLines size={20} />
        )}
      </div>
      <div className="overlay-content">
        {state.phase === 'recording' ? (
          <AudioVisualizer isActive analyser={studio.analyser} size="sm" />
        ) : (
          <span>
            {studio.error ||
              state.error ||
              (state.draft
                ? 'Your draft is ready to review.'
                : 'Ctrl / Cmd + Shift + Space to record')}
          </span>
        )}
      </div>
      {state.phase === 'recording' && (
        <button
          aria-label="Finish recording"
          onClick={() => {
            void finish();
          }}
        >
          <Square size={16} />
        </button>
      )}
      {state.phase === 'idle' && state.draft && (
        <button
          aria-label="Review draft"
          onClick={() => {
            void window.mira?.window.show();
            void window.mira?.overlay.hide();
          }}
        >
          <ArrowUpRight size={18} />
        </button>
      )}
      <button
        aria-label="Dismiss overlay"
        onClick={() => {
          void cancel().then(() => window.mira?.overlay.hide());
        }}
      >
        <X size={17} />
      </button>
    </div>
  );
};
export default Overlay;
