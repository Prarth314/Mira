import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  analyser?: AnalyserNode | null;
  size?: 'sm' | 'lg';
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, analyser, size = 'lg' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive || !analyser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);

      const bars = 48;
      const gap = 2;
      const barWidth = (w - gap * (bars - 1)) / bars;
      const step = Math.floor(bins / bars);

      ctx.fillStyle = '#60a5fa';
      for (let i = 0; i < bars; i++) {
        const v = data[i * step] / 255;
        const eased = Math.pow(v, 1.6);
        const barH = Math.max(2, eased * h * 0.92);
        const x = i * (barWidth + gap);
        const y = (h - barH) / 2;
        ctx.fillRect(x, y, barWidth, barH);
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [isActive, analyser]);

  const heightClass = size === 'sm' ? 'h-12' : 'h-24';

  return (
    <div className={`relative w-full ${heightClass} flex items-center justify-center`}>
      {isActive ? (
        <canvas ref={canvasRef} className="w-full h-full" />
      ) : (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-zinc-600"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
