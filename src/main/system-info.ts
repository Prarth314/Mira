import si from 'systeminformation';

export type Telemetry = {
  cpuLoad: number;       // 0..100
  memUsedGB: number;
  memTotalGB: number;
  battery: number | null; // 0..100, null if not available
};

export async function readTelemetry(): Promise<Telemetry> {
  const [load, mem, batt] = await Promise.all([si.currentLoad(), si.mem(), si.battery()]);
  const memUsedGB = (mem.total - mem.available) / (1024 ** 3);
  const memTotalGB = mem.total / (1024 ** 3);
  const battery = batt.hasBattery ? batt.percent : null;
  return {
    cpuLoad: Math.round(load.currentLoad * 10) / 10,
    memUsedGB: Math.round(memUsedGB * 10) / 10,
    memTotalGB: Math.round(memTotalGB * 10) / 10,
    battery,
  };
}
