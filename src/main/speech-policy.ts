/** Portable beta baseline. Physical-device GPU tuning remains a release gate. */
export function speechRuntimeOptions(platform: NodeJS.Platform, processors: number): string[] {
  const threads = Math.max(
    1,
    Math.min(4, Number.isFinite(processors) ? Math.floor(processors) : 1),
  );
  return [...(platform === 'darwin' ? ['-ng'] : []), '-t', String(threads)];
}
