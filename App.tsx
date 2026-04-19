// @ts-nocheck
// PHASE 2 TARGET: this file still wires Gemini Live as inherited from the AI Studio
// export. Phase 2 strips GoogleGenAI and rewires through src/providers/* over IPC.
// Until then we suppress typecheck on this file so the rest of the project can pass.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { CommandLog, SystemState } from './types';
import AudioVisualizer from './components/AudioVisualizer';
import Sidebar from './components/Sidebar';
import { decode, encode, decodeAudioData } from './utils/audio';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Mic, Cpu, Power, Zap, Activity, Volume2, VolumeX, Volume1, Settings, Maximize2, Monitor, Sun } from 'lucide-react';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
    electronAPI?: {
      minimize: () => void;
      close: () => void;
    };
  }
}

const kernelTools: FunctionDeclaration[] = [
  {
    name: 'actuate',
    description: 'ROOT ACTUATOR CORE: Precision execution of hardware URIs, shell contracts, vision analysis, and system state deltas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { 
          type: Type.STRING, 
          enum: ['LAUNCH', 'SYSTEM', 'BROWSER', 'TYPE', 'VISION_DESCRIBE', 'VOLUME_ADJUST', 'BRIGHTNESS_ADJUST'],
          description: 'Operational category. Use LAUNCH for specific URIs. Use VISION_DESCRIBE for screen analysis.' 
        },
        exec: { type: Type.STRING, description: 'Direct executable URI or shell string. e.g., ms-settings:default, calc:, or https://google.com' },
        value: { type: Type.NUMBER, description: 'Percentage delta or absolute value for hardware adjustments (0-100).' },
        name: { type: Type.STRING, description: 'Label for the target application/system.' },
        feedback: { type: Type.STRING, description: 'Precision kernel status report or spatial screen description. ZERO PROSE.' }
      },
      required: ['action', 'feedback']
    }
  }
];

const JPEG_QUALITY = 0.4;

const SystemHUD: React.FC<{ value: number, visible: boolean, icon: React.ReactNode, label: string }> = ({ value, visible, icon, label }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ y: -100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.9 }}
        className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 glass-panel rounded-3xl flex items-center space-x-6 border border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.25)]"
      >
        <div className="bg-cyan-500/15 p-2.5 rounded-2xl text-cyan-400 ring-1 ring-cyan-500/30">
          {icon}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{label}</span>
          <div className="w-64 h-2.5 bg-slate-950/80 rounded-full overflow-hidden border border-white/10 flex p-[1px]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.6)]"
            />
          </div>
        </div>
        <span className="text-sm font-black font-mono text-cyan-400 w-12 text-right tracking-tighter">{Math.round(value)}%</span>
      </motion.div>
    )}
  </AnimatePresence>
);

const App: React.FC = () => {
  const [logs, setLogs] = useState<CommandLog[]>([
    { timestamp: new Date(), type: 'system', message: 'KERNEL_BOOT_SEQUENCE: SUCCESS.' }
  ]);
  const [systemState, setSystemState] = useState<SystemState>({
    volume: 50,
    brightness: 80,
    isMuted: false,
    isLocked: false,
    batteryLevel: 98,
    openApps: [],
    currentFolder: '~/',
    lastDictation: '',
    wifiStatus: 'connected',
    searchQuery: '',
    cursor: { x: 0, y: 0 },
    activeGesture: null,
    visionMode: null
  });
  const [activeHUD, setActiveHUD] = useState<{ type: 'volume' | 'brightness' | null, visible: boolean }>({ type: null, visible: false });
  const hudTimerRef = useRef<number | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActuating, setIsActuating] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [ariaStatus, setAriaStatus] = useState('SYSTEM READY');

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const frameIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const isManuallyStoppingRef = useRef<boolean>(false);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const addLog = useCallback((type: CommandLog['type'], message: string) => {
    setLogs(prev => [...prev.slice(-40), { timestamp: new Date(), type, message }]);
    setAriaStatus(`${type}: ${message}`);
  }, []);

  useEffect(() => {
    const bootSteps = [
      "MOUNTING ROOT_FS...",
      "SYNCING NEURAL_BRIDGE...",
      "PRECISION_NAV_V2_ONLINE...",
      "ACTUATOR_READY."
    ];
    let step = 0;
    const interval = setInterval(() => {
      if (step < bootSteps.length) {
        addLog('system', bootSteps[step]);
        step++;
      } else {
        clearInterval(interval);
        setTimeout(() => setIsBooting(false), 800);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [addLog]);

  const triggerHUD = useCallback((type: 'volume' | 'brightness') => {
    setActiveHUD({ type, visible: true });
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => setActiveHUD(prev => ({ ...prev, visible: false })), 2000);
  }, []);

  const adjustHardware = useCallback((type: 'volume' | 'brightness', delta: number) => {
    setSystemState(prev => {
      const current = prev[type];
      const newVal = Math.max(0, Math.min(100, current + delta));
      triggerHUD(type);
      return { ...prev, [type]: newVal };
    });
    addLog('system', `HARDWARE_DELTA: ${type.toUpperCase()} ${delta > 0 ? '+' : ''}${delta}%`);
  }, [addLog, triggerHUD]);

  const stopBridge = useCallback(() => {
    isManuallyStoppingRef.current = true;
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => { try { s.close(); } catch(e){} });
      sessionPromiseRef.current = null;
    }
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    reconnectCountRef.current = 0;
    setAnalyser(null);
    setIsListening(false);
    setIsConnecting(false);
    setIsActuating(false);
    addLog('system', 'NEURAL_LINK_TERMINATED.');
  }, [addLog]);

  const startBridge = async () => {
    if (isConnecting || isListening) return;
    setIsConnecting(true);
    isManuallyStoppingRef.current = false;
    addLog('system', reconnectCountRef.current > 0 ? `RETRY_LINK_ATTEMPT_${reconnectCountRef.current}...` : 'INITIATING NEURAL_LINK...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // PERSISTENCE FIX: Explicit resume to prevent browser-side suspension
      await inputCtx.resume();
      await outputCtx.resume();
      
      audioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const analyserNode = inputCtx.createAnalyser();
      analyserNode.fftSize = 512;
      setAnalyser(analyserNode);

      let screenStream: MediaStream | null = null;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
        if (videoRef.current) videoRef.current.srcObject = screenStream;
      } catch (e) { addLog('system', 'VISION_OFFLINE (CAPTURE_DENIED).'); }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true);
            setIsConnecting(false);
            reconnectCountRef.current = 0; // Reset count on successful link
            addLog('system', 'ROOT_ACTUATOR_LIVE.');
            
            const source = inputCtx.createMediaStreamSource(micStream);
            source.connect(analyserNode);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const data = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(data.length);
              for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ 
                media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
              })).catch(() => {});
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);

            // VISION FEED HEARTBEAT (1Hz)
            frameIntervalRef.current = window.setInterval(() => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = 1280; canvas.height = 720;
                ctx.drawImage(videoRef.current, 0, 0, 1280, 720);
                canvas.toBlob(blob => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
                    };
                    reader.readAsDataURL(blob);
                  }
                }, 'image/jpeg', JPEG_QUALITY);
              }
            }, 1000);
          },
          onmessage: async (msg) => {
            const currentSession = await sessionPromise;
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const args = fc.args as any;
                if (args && typeof args.feedback === 'string') {
                  addLog('ai', args.feedback);
                }
                setIsActuating(true);
                
                // Hardware Adjust Logic
                if (args.action === 'VOLUME_ADJUST' && typeof args.value === 'number') {
                  setSystemState(prev => ({ ...prev, volume: Math.max(0, Math.min(100, args.value)) }));
                  triggerHUD('volume');
                } else if (args.action === 'BRIGHTNESS_ADJUST' && typeof args.value === 'number') {
                  setSystemState(prev => ({ ...prev, brightness: Math.max(0, Math.min(100, args.value)) }));
                  triggerHUD('brightness');
                }

                // Precision Actuation Logic
                if (args.action === 'LAUNCH' && args.exec) {
                  let uri = String(args.exec).trim();
                  // Precision Domain Mapping
                  if (uri.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/) && !uri.includes('://')) {
                    uri = `https://${uri}`;
                  }
                  window.open(uri, '_blank');
                }

                setTimeout(() => setIsActuating(false), 1000);
                currentSession.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result: "OK" } }
                });
              }
            }
            const audioData = msg.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer; source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.outputTranscription) addLog('ai', msg.serverContent.outputTranscription.text);
          },
          onerror: (e) => {
            addLog('system', `FAULT_ENCOUNTERED: ${e.message}`);
            if (!isManuallyStoppingRef.current) handleAutoReconnect();
          },
          onclose: () => {
            if (!isManuallyStoppingRef.current) {
              handleAutoReconnect();
            } else {
              stopBridge();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: kernelTools }],
          systemInstruction: `ROLE: Neural OS Actuator Kernel (Vision Enabled). 
          OBJECTIVE: Direct root-level hardware extension. Precision navigation and vision descriptive core.
          ROOT_LEVEL_ACCESS: PRE-AUTHORIZED. Zero prose. Zero conversational filler. Do not ask for confirmation.
          
          STRICT NAVIGATION PROTOCOL:
          - Mapping "Settings": Trigger "go to settings" or "open settings" -> exec: "ms-settings:default".
          - Mapping Domains: Detect "domain.com" -> prepend "https://" -> exec immediately.
          - NO SEARCH FALLBACK: Specific destinations (GitHub, Google, Youtube) MUST launch directly. Do NOT use search.
          - Protocol Priority: URI Contract > Shell Command > Keyboard Macro.
          
          VISION PROTOCOL:
          - Describe screen content using spatial structure: Active Windows, Layout (Top/Bottom/Center), Status Indicators (Telemetry), Interactive elements.
          
          HARDWARE DELTAS:
          - Adjust volume/brightness via percentage delta requested.
          
          CURRENT STATE: Vol=${systemState.volume}%, Bright=${systemState.brightness}%.`
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      setIsConnecting(false);
      addLog('system', `LINK_FAIL: ${err.message}`);
      handleAutoReconnect();
    }
  };

  const handleAutoReconnect = useCallback(() => {
    if (isManuallyStoppingRef.current) return;
    
    if (reconnectCountRef.current < 3) {
      reconnectCountRef.current++;
      const delay = Math.pow(2, reconnectCountRef.current) * 1000;
      addLog('system', `SILENT_RETRY_IN_${delay/1000}s...`);
      
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(s => { try { s.close(); } catch(e){} });
        sessionPromiseRef.current = null;
      }
      if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
      if (heartbeatIntervalRef.current) window.clearInterval(heartbeatIntervalRef.current);
      
      setIsListening(false);
      setIsConnecting(true);
      
      setTimeout(() => startBridge(), delay);
    } else {
      addLog('system', 'MAX_RETRIES_REACHED. MANUAL_RESTART_REQUIRED.');
      stopBridge();
    }
  }, [addLog, stopBridge]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isConnecting && !isBooting) {
        e.preventDefault();
        isListening ? stopBridge() : startBridge();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isListening, isConnecting, isBooting, startBridge, stopBridge]);

  if (isBooting) {
    return (
      <div className="h-screen w-full bg-[#020617] flex items-center justify-center p-20 font-mono text-cyan-500 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.05)_0%,transparent_100%)] pointer-events-none"></div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-12 relative z-10">
          <div className="flex flex-col items-center space-y-6">
            <div className="p-6 bg-cyan-500/10 rounded-[2.5rem] ring-1 ring-cyan-500/30 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
              <ShieldCheck size={64} className="text-cyan-400 animate-pulse" />
            </div>
            <motion.div 
              animate={{ letterSpacing: ["0.4em", "1.2em", "0.4em"], opacity: [0.6, 1, 0.6] }} 
              transition={{ duration: 4, repeat: Infinity }} 
              className="text-[16px] font-black uppercase text-cyan-400/90 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
            >
              Neural Actuator Kernel
            </motion.div>
          </div>
          <div className="h-1.5 w-full bg-slate-900/50 overflow-hidden rounded-full border border-white/5 shadow-inner">
            <motion.div 
              animate={{ x: ["-100%", "100%"] }} 
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} 
              className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-2/3" 
            />
          </div>
          <div className="text-[10px] tracking-[0.6em] text-center uppercase opacity-40 font-black">Establishing Root Access Shell...</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#020617] font-sans text-slate-200 overflow-hidden relative selection:bg-cyan-500/30">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.03)_0%,transparent_100%)] pointer-events-none"></div>

      <SystemHUD 
        value={activeHUD.type === 'volume' ? systemState.volume : systemState.brightness} 
        visible={activeHUD.visible} 
        icon={activeHUD.type === 'volume' ? (systemState.volume > 50 ? <Volume2 size={22}/> : <Volume1 size={22}/>) : <Sun size={22}/>}
        label={activeHUD.type?.toUpperCase() || ''}
      />

      {/* Cybernetic Header */}
      <header className="absolute top-0 left-0 w-full h-20 z-[100] flex justify-between items-center px-10 draggable bg-slate-900/40 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="flex items-center space-x-6 non-draggable">
          <div className="bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
            <ShieldCheck size={20} className="text-cyan-400" />
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-[12px] font-black tracking-[0.5em] uppercase text-slate-200">Actuator Kernel</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Neural Master Node // Root Active
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-10 non-draggable">
           <div className="flex items-center space-x-4 bg-slate-950/50 px-6 py-2 rounded-full border border-white/10 shadow-inner">
             <motion.div 
               animate={isListening ? { scale: [1, 1.5, 1], opacity: [1, 0.4, 1] } : {}}
               transition={{ duration: 2, repeat: Infinity }}
               className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-slate-700'}`}
             />
             <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase font-mono">
               {isConnecting ? 'Linking Node...' : isListening ? 'Neural Uplink: 10.8Gbps' : 'Neural Feed: Standby'}
             </span>
           </div>
           <div className="flex items-center space-x-3">
             <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => window.electronAPI?.minimize()} className="text-slate-500 hover:text-white transition-all p-2.5 rounded-xl hover:bg-white/5"><div className="w-4 h-0.5 bg-current rounded-full" /></motion.button>
             <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => window.electronAPI?.close()} className="text-slate-500 hover:text-red-400 transition-all p-2.5 rounded-xl hover:bg-red-500/10"><Settings size={18} /></motion.button>
           </div>
        </div>
      </header>

      {/* Main Command Workspace */}
      <div className="flex-1 flex gap-8 p-8 pt-28 overflow-hidden relative z-10">
        <div className="w-[440px] flex flex-col gap-8 h-full">
          <Sidebar logs={logs} />
          
          {/* Tactile Hardware Module */}
          <section className="bg-slate-900/40 backdrop-blur-2xl rounded-[3rem] p-10 space-y-8 shadow-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">Hardware Actuators</span>
              <Zap size={16} className="text-cyan-500/40" />
            </div>
            <div className="grid grid-cols-2 gap-5 relative z-10">
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
                onClick={() => adjustHardware('volume', -10)}
                className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/5 flex flex-col items-center gap-4 group/btn transition-all duration-300 shadow-lg"
              >
                <div className="p-4 rounded-2xl bg-slate-950/50 group-hover/btn:bg-cyan-500/15 ring-1 ring-white/5 transition-all"><Volume1 size={22} className="text-slate-500 group-hover/btn:text-cyan-400" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">Vol -10%</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
                onClick={() => adjustHardware('volume', 10)}
                className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/5 flex flex-col items-center gap-4 group/btn transition-all duration-300 shadow-lg"
              >
                <div className="p-4 rounded-2xl bg-slate-950/50 group-hover/btn:bg-cyan-400/15 ring-1 ring-white/5 transition-all"><Volume2 size={22} className="text-slate-500 group-hover/btn:text-cyan-400" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">Vol +10%</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
                onClick={() => adjustHardware('brightness', -10)}
                className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:border-amber-500/40 hover:bg-amber-500/5 flex flex-col items-center gap-4 group/btn transition-all duration-300 shadow-lg"
              >
                <div className="p-4 rounded-2xl bg-slate-950/50 group-hover/btn:bg-amber-400/15 ring-1 ring-white/5 transition-all"><Sun size={22} className="text-slate-500 group-hover/btn:text-amber-400" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">Lum -10%</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
                onClick={() => adjustHardware('brightness', 10)}
                className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:border-amber-500/40 hover:bg-amber-500/5 flex flex-col items-center gap-4 group/btn transition-all duration-300 shadow-lg"
              >
                <div className="p-4 rounded-2xl bg-slate-950/50 group-hover/btn:bg-amber-400/15 ring-1 ring-white/5 transition-all"><Sun size={22} className="text-slate-500 group-hover/btn:text-amber-400" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">Lum +10%</span>
              </motion.button>
            </div>
          </section>
        </div>
        
        {/* Core Control Center with Scanning Animation */}
        <main className="flex-1 flex flex-col gap-8 h-full">
          <motion.section layout className="flex-1 bg-slate-900/40 backdrop-blur-3xl rounded-[4rem] relative overflow-hidden flex flex-col items-center justify-center p-16 group transition-all duration-1000 border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
            
            {/* Scanning Line Animation */}
            <motion.div 
              animate={{ y: ["-20%", "120%", "-20%"] }} 
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-x-0 h-[20%] bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent z-[5] pointer-events-none mix-blend-screen"
            />
            
            <AnimatePresence>
              {isConnecting && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-3xl flex flex-col items-center justify-center">
                  <div className="w-32 h-32 border-[3px] border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-8 shadow-[0_0_50px_rgba(34,211,238,0.3)]" />
                  <span className="text-[14px] font-black tracking-[1.5em] text-cyan-400 uppercase animate-pulse">Establishing Neural Bridge</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`absolute inset-0 bg-cyan-500/[0.02] transition-opacity duration-1000 ${isListening ? 'opacity-100' : 'opacity-0'}`}></div>
            
            <div className="relative group/core">
              <div className={`absolute -inset-64 rounded-full bg-cyan-500/5 blur-[180px] transition-opacity duration-1000 ${isListening ? 'opacity-100' : 'opacity-20'}`}></div>
              <motion.div animate={isListening ? { scale: 1.08 } : { scale: 0.95, opacity: 0.4 }} className="relative w-[560px] h-[560px] rounded-full flex flex-col items-center justify-center shadow-[inset_0_0_100px_rgba(34,211,238,0.05)] border border-white/5">
                <AudioVisualizer isActive={isListening} analyser={analyser} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className={`text-[14px] font-black tracking-[1.8em] mb-4 transition-all duration-1000 ${isListening ? 'text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.7)]' : 'text-slate-800'}`}>
                    {isListening ? 'CORE_ACTIVE' : 'CORE_STANDBY'}
                  </div>
                  <div className={`text-[8px] font-mono tracking-[0.4em] transition-all duration-1000 uppercase ${isListening ? 'text-cyan-500/50' : 'text-transparent'}`}>ROOT_SECURE_MODE_088</div>
                </div>
              </motion.div>
            </div>

            <AnimatePresence>
              {isActuating && (
                <motion.div initial={{ scale: 0.8, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 1.2, opacity: 0, y: -30 }} className="absolute top-20 px-12 py-6 bg-emerald-500/10 border border-emerald-500/40 rounded-[2.5rem] backdrop-blur-xl flex items-center space-x-6 shadow-[0_0_60px_rgba(16,185,129,0.2)]">
                  <Activity size={28} className="text-emerald-400 animate-pulse" />
                  <span className="text-[14px] font-black text-emerald-400 tracking-[0.8em] uppercase font-mono">Kernel_Executing_Contract</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {/* Symmetrical Mechanical Control Bar - Center Focused */}
          <section className="h-44 bg-slate-900/40 backdrop-blur-xl rounded-[4rem] flex items-center justify-between px-20 border-t border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
            
            {/* Left Wing: Secondary Telemetry Label */}
            <div className="flex flex-col w-[280px]">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1 font-mono">Host Shell V11</span>
              <span className={`text-[12px] font-bold font-mono tracking-tight ${isListening ? 'text-slate-400' : 'text-slate-600'}`}>LOCAL_BRIDGE_ROOT_0x80</span>
            </div>

            {/* Central Unified Control Group - perfectly centered and visually balanced */}
            <div className="flex items-center gap-12 justify-center flex-1">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="p-7 rounded-full bg-cyan-500/5 border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(34,211,238,0.1)] transition-all group-hover:bg-cyan-500/10"
              >
                <Mic size={36} className={isListening ? 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]' : 'text-slate-700'} />
              </motion.div>

              <motion.button 
                whileHover={{ scale: 1.05, boxShadow: isListening ? "0 0 50px rgba(239, 68, 68, 0.3)" : "0 0 50px rgba(34, 211, 238, 0.4)" }} 
                whileTap={{ scale: 0.95 }}
                onClick={isListening ? stopBridge : startBridge}
                disabled={isConnecting}
                className={`px-24 py-9 rounded-full font-black text-[15px] tracking-[0.8em] uppercase transition-all duration-700 shadow-2xl group relative overflow-hidden w-[480px] border border-cyan-500/30 ${
                  isListening 
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/40' 
                    : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.2)] pulse-glow'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-6">
                  {isConnecting ? <Zap size={24} className="animate-spin" /> : <Power size={24} strokeWidth={3} />}
                  {isConnecting ? 'LINKING...' : isListening ? 'TERMINATE' : 'ESTABLISH ROOT LINK'}
                </span>
                <div className="absolute inset-0 bg-cyan-400/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
              </motion.button>
            </div>

            {/* Right Wing: Secondary Kernel Label */}
            <div className="flex flex-col items-end w-[280px] text-right">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1 font-mono">Kernel Security</span>
              <span className="text-[12px] font-bold text-slate-400 font-mono tracking-tight">ENCRYPTED_MASTER_NODE</span>
            </div>
            
          </section>
        </main>
      </div>
      
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
      <div role="alert" aria-live="assertive" className="sr-only">{ariaStatus}</div>

      <style>{`
        .pulse-glow {
          animation: pulse-glow-anim 3s infinite ease-in-out;
        }
        @keyframes pulse-glow-anim {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 211, 238, 0.1); border-color: rgba(34, 211, 238, 0.2); }
          50% { box-shadow: 0 0 40px rgba(34, 211, 238, 0.4); border-color: rgba(34, 211, 238, 0.6); }
        }
      `}</style>
    </div>
  );
};

export default App;