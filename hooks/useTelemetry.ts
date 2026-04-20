import { useEffect, useState } from 'react';
import type { Telemetry } from '../src/types/window';

export function useTelemetry(intervalMs = 2500): Telemetry | null {
  const [data, setData] = useState<Telemetry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const api = window.mira;
      if (!api) return;
      try {
        const res = await api.telemetry.read();
        if (!cancelled && res.ok) setData(res.data);
      } catch {/* noop */}
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return data;
}
