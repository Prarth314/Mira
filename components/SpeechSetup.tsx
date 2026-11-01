import React, { useCallback, useEffect, useState } from 'react';

export default function SpeechSetup({
  disabled,
  model,
  progress,
  download,
  refreshModel,
}: {
  disabled: boolean;
  model: { present: boolean; runtimeAvailable: boolean } | null;
  progress: number | null;
  download: () => Promise<void>;
  refreshModel: () => Promise<void>;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState('default');
  const [permission, setPermission] = useState('unknown');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const api = window.mira;
  const refresh = useCallback(async () => {
    if (!api) return;
    const [settings, permissions, inputs, desktop] = await Promise.all([
      api.settings.get(),
      api.permissions.probe(),
      navigator.mediaDevices.enumerateDevices(),
      api.desktop.status(),
    ]);
    setDevice(settings.microphoneId);
    setPermission(permissions.microphone);
    setDevices(
      inputs.filter((input) => input.kind === 'audioinput' && input.deviceId !== 'default'),
    );
    setConflict(!desktop.shortcuts.record || !desktop.shortcuts.workspace);
  }, [api]);
  useEffect(() => {
    if (!api) return;
    let current = true;
    const changed = () => {
      if (current)
        void refresh().catch(() => setMessage('Could not refresh microphone setup. Try again.'));
    };
    changed();
    navigator.mediaDevices.addEventListener('devicechange', changed);
    return () => {
      current = false;
      navigator.mediaDevices.removeEventListener('devicechange', changed);
    };
  }, [api, refresh]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch {
      setMessage(
        'Microphone unavailable or permission denied. Check your input device and OS microphone settings, then refresh.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface speech-setup" aria-labelledby="speech-setup-title">
      <h2 id="speech-setup-title">Speech setup</h2>
      <p>
        Local English transcription · no provider key required. Choose an input, check permission,
        and verify the model before recording.
      </p>
      <p role="status">
        {model
          ? `${model.runtimeAvailable ? 'Speech runtime ready' : 'Speech runtime unavailable — reinstall a packaged build or run npm run prepare:speech in development'}. ${model.present ? 'Model verified.' : 'Download the English model (~148 MB) before transcribing.'}`
          : 'Inspecting local speech setup…'}
      </p>
      <label htmlFor="microphone-input">Microphone</label>
      <select
        id="microphone-input"
        value={device}
        disabled={!api || disabled || busy}
        onChange={(event) => {
          const selected = event.target.value;
          void perform(async () => {
            await api!.settings.update({ microphoneId: selected });
            setDevice(selected);
            setMessage('Microphone selection saved for workspace and compact recordings.');
          });
        }}
      >
        <option value="default">System default microphone</option>
        {device !== 'default' && !devices.some((input) => input.deviceId === device) && (
          <option value={device}>Previously selected microphone (unavailable)</option>
        )}
        {devices.map((input, i) => (
          <option key={input.deviceId} value={input.deviceId}>
            {input.label || `Microphone ${i + 1}`}
          </option>
        ))}
      </select>
      <p>
        OS microphone permission: {permission}. Device names may appear after permission is granted.
      </p>
      <div className="setup-actions">
        <button
          className="secondary-button"
          disabled={!api || disabled || busy}
          onClick={() => {
            void perform(async () => {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: device === 'default' ? true : { deviceId: { exact: device } },
              });
              stream.getTracks().forEach((track) => track.stop());
              await refresh();
              setMessage(
                'Microphone access checked. The test stream was stopped; no audio was transcribed or saved.',
              );
            });
          }}
        >
          Check microphone access
        </button>
        <button
          className="text-button"
          disabled={!api || disabled || busy}
          onClick={() => {
            void perform(async () => {
              await refresh();
              await refreshModel();
            });
          }}
        >
          Refresh speech setup
        </button>
        <button
          className="text-button"
          disabled={!api || disabled || busy}
          onClick={() => {
            void perform(async () => {
              await api!.permissions.openSettings('mic');
            });
          }}
        >
          Open microphone settings
        </button>
        {model && !model.present && (
          <button
            className="secondary-button"
            disabled={!api || disabled || busy || progress !== null}
            onClick={() => {
              void download();
            }}
          >
            {progress !== null ? `Downloading ${progress}%` : 'Download model'}
          </button>
        )}
        {progress !== null && (
          <button
            className="secondary-button"
            onClick={() => {
              void api?.model.cancel();
            }}
          >
            Cancel download
          </button>
        )}
      </div>
      {conflict && (
        <p className="notice" role="status">
          A global shortcut is unavailable, possibly because another application owns it. Workspace
          recording remains available.
        </p>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
