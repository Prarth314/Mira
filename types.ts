
export interface SystemState {
  volume: number;
  brightness: number;
  isMuted: boolean;
  isLocked: boolean;
  batteryLevel: number;
  openApps: string[];
  currentFolder: string;
  lastDictation: string;
  wifiStatus: 'connected' | 'disconnected' | 'searching';
  searchQuery: string;
  activeHUD?: 'volume' | 'brightness' | 'gesture' | 'vision' | null;
  cursor: { x: number; y: number };
  activeGesture: string | null;
  visionMode: 'describe' | 'navigate' | 'read' | null;
}

export type CommandLog = {
  timestamp: Date;
  type: 'user' | 'system' | 'ai' | 'gesture';
  message: string;
};
