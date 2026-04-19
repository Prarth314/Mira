import { useCallback, useEffect, useState } from 'react';
import type { PermissionsReport } from '../src/types/window';

export function usePermissions() {
  const [report, setReport] = useState<PermissionsReport | null>(null);

  const refresh = useCallback(async () => {
    const api = window.mira;
    if (!api) return;
    try {
      const r = await api.permissions.probe();
      setReport(r);
    } catch {/* noop */}
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestMic = useCallback(async () => {
    await window.mira?.permissions.requestMic();
    await refresh();
  }, [refresh]);

  const openSettings = useCallback((what: 'mic' | 'screen') => {
    void window.mira?.permissions.openSettings(what);
  }, []);

  return { report, refresh, requestMic, openSettings };
}
