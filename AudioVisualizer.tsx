
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  analyser?: AnalyserNode | null;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive || !analyser) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const baseRadius = 70;
      const pulseRadius = baseRadius + (avg / 255) * 120;

      // 1. External Aura (Bloom Effect)
      const auraGradient = ctx.createRadialGradient(centerX, centerY, baseRadius, centerX, centerY, pulseRadius + 60);
      auraGradient.addColorStop(0, 'rgba(34, 211, 238, 0.1)');
      auraGradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.02)');
      auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius + 60, 0, Math.PI * 2);
      ctx.fillStyle = auraGradient;
      ctx.fill();

      // 2. Kinetic Pulse Rings
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const ringRadius = baseRadius + (i * 25) + (avg / 255) * 40;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 - i * 0.04})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Core Bioluminescent Point
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6 + (avg / 255) * 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#22d3ee';
      ctx.fill();
      ctx.shadowBlur = 0;

      // 4. Neural Waveform (Polygon)
      ctx.beginPath();
      for (let i = 0; i < bufferLength; i += 2) {
        const val = dataArray[i];
        const angle = (i / bufferLength) * Math.PI * 2;
        const dist = baseRadius + (val / 255) * 90;
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 5. Outer Dynamic Web
      ctx.beginPath();
      for (let i = 0; i < bufferLength; i += 16) {
        const val = dataArray[i];
        const angle = (i / bufferLength) * Math.PI * 2;
        const dist = baseRadius + 40 + (val / 255) * 110;
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isActive, analyser]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {isActive ? (
        <canvas 
          ref={canvasRef} 
          width={450} 
          height={450} 
          className="w-full h-full"
        />
      ) : (
        <div className="relative flex items-center justify-center">
           <div className="absolute inset-0 w-32 h-32 bg-cyan-500/10 rounded-full animate-slow-pulse blur-2xl"></div>
           <div className="w-3 h-3 rounded-full bg-slate-800 animate-pulse relative z-10 border border-slate-700 shadow-xl"></div>
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
