import { app, BrowserWindow, clipboard } from 'electron';
import { randomUUID } from 'node:crypto';
import { SessionCoordinator, type VoiceSession } from './session';
import { handle, windowRole } from './security';
import { record, text } from './validation';
import { getFrontmostApp } from './frontmost-app';
import { routeDevPrompt, classifyApp } from './dev-tool-router';
import { transcribePcm } from './stt';
import { getSettings } from './settings';
import { getKey } from './keystore';
import { createProvider } from '../providers';
import { MiraError } from '../types/MiraError';
import type {
  ContextAttachment,
  Destination,
  Draft,
  StudioState,
  VoiceMode,
} from '../types/studio';
import {
  selectedContext,
  contextUnchanged,
  projectVocabulary,
  rememberAlias,
  vocabularyFileCurrent,
} from './project';
import { suggestTerms } from './vocabulary';
import type { VocabularySnapshot } from '../types/vocabulary';
import { formatPrompt } from './project-index';
import { refinementLosses } from './refinement-policy';
import { refineInstruction } from './refinement';

const sessions = new SessionCoordinator();
let state: StudioState = { phase: 'idle', sessionId: null, draft: null, error: null };
const metadata = new Map<
  string,
  {
    mode: VoiceMode;
    destination: Promise<Destination | null>;
    context: ContextAttachment[];
    vocabulary: VocabularySnapshot | null;
  }
>();
const attempted = new Set<string>();
let draftVocabulary: VocabularySnapshot | null = null;

function terminology(prompt: string) {
  return draftVocabulary
    ? {
        projectName: draftVocabulary.name,
        suggestions: suggestTerms(prompt, draftVocabulary),
      }
    : undefined;
}

function publish(patch: Partial<StudioState>): void {
  state = { ...state, ...patch };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('mira:studio:state', state);
  }
}

export function cancelStudioOwner(
  owner: number,
  notice = 'Recording cancelled. Your previous draft is preserved.',
): void {
  if (!sessions.cancelOwner(owner)) return;
  if (state.sessionId) metadata.delete(state.sessionId);
  publish({ phase: 'idle', sessionId: null, notice, error: null });
}

export function cancelAllStudio(notice: string): void {
  for (const win of BrowserWindow.getAllWindows()) cancelStudioOwner(win.webContents.id, notice);
}

function voiceMode(value: unknown): VoiceMode {
  if (value !== 'dictate' && value !== 'refine')
    throw new MiraError('action_invalid', 'Invalid voice mode');
  return value;
}

function requireDraft(id: unknown): Draft {
  if (!state.draft || state.draft.id !== id)
    throw new MiraError('action_invalid', 'Draft is no longer available');
  if (state.phase !== 'idle')
    throw new MiraError('action_invalid', 'Wait for the current operation');
  return state.draft;
}

async function prepare(original: string, session: VoiceSession, previous?: Draft): Promise<void> {
  const current = metadata.get(session.id);
  if (!current) throw new MiraError('action_invalid', 'Session is no longer available');
  const currentMode = current.mode;
  const currentDestination = await current.destination;
  session.controller.signal.throwIfAborted();
  const context = current.context;
  let prompt = original;
  let error: string | null = null;
  if (currentMode === 'refine') {
    publish({ phase: 'refining' });
    const result = await refineInstruction(
      original,
      async () => {
        const settings = await getSettings();
        const key = await getKey(settings.defaultProvider);
        if (!key) throw new Error('Provider key unavailable');
        return createProvider({ name: settings.defaultProvider, apiKey: key });
      },
      session.controller.signal,
    );
    prompt = result.prompt;
    if (result.issue)
      error =
        result.issue === 'details'
          ? 'The refinement may have changed technical details or constraints. Your reviewed instruction was retained.'
          : 'Refinement was unavailable. Your reviewed instruction is preserved; check Settings or use dictation.';
  }
  sessions.require(session.owner, session.id);
  draftVocabulary = current.vocabulary;
  publish({
    draft: {
      id: previous?.id ?? randomUUID(),
      original: previous?.original ?? original,
      prompt,
      mode: currentMode,
      destination: currentDestination,
      createdAt: new Date().toISOString(),
      delivery: 'prepared',
      context,
      terminology: terminology(prompt),
      reviewWarnings: refinementLosses(previous?.original ?? original, prompt),
    },
    error,
  });
}

export function registerStudio(): void {
  app.on('web-contents-created', (_event, contents) => {
    const cancelOwner = () => cancelStudioOwner(contents.id);
    contents.once('destroyed', cancelOwner);
    contents.on('render-process-gone', cancelOwner);
  });

  handle('mira:studio:get', () => state);
  handle(
    'mira:studio:cancelActive',
    (_event, value: unknown) => {
      const id = text(value, 'Session ID', 64);
      if (state.sessionId !== id || state.phase === 'delivering')
        throw new MiraError('action_invalid', 'No cancellable session matches this request');
      sessions.cancelCurrent(id);
      metadata.delete(id);
      publish({
        phase: 'idle',
        sessionId: null,
        error: null,
        notice: 'Session cancelled. Your previous draft is preserved.',
      });
    },
    ['workspace'],
  );
  handle('mira:studio:start', (event, value: unknown) => {
    if (state.phase !== 'idle')
      throw new MiraError('action_invalid', 'Another operation is active');
    const nextMode = voiceMode(value);
    const session = sessions.begin(event.sender.id);
    const destination =
      windowRole(event.sender.id) === 'overlay'
        ? getFrontmostApp(session.controller.signal)
            .then((target) =>
              target.processId !== process.pid && classifyApp(target) !== 'unknown' ? target : null,
            )
            .catch(() => null)
        : Promise.resolve(null);
    metadata.set(session.id, {
      mode: nextMode,
      destination,
      context: selectedContext(),
      vocabulary: projectVocabulary(),
    });
    publish({
      phase: 'recording',
      sessionId: session.id,
      error: null,
      notice: null,
      recordingMs: 0,
    });
    return { id: session.id };
  });
  handle('mira:studio:chunk', (event, payload: unknown) => {
    const value = record(payload);
    if (
      !(value.data instanceof ArrayBuffer) ||
      value.data.byteLength > 32768 ||
      value.data.byteLength % 2 !== 0
    ) {
      throw new MiraError('action_invalid', 'Invalid PCM audio chunk');
    }
    sessions.append(event.sender.id, text(value.id, 'Session ID', 64), Buffer.from(value.data));
    const session = sessions.require(event.sender.id, String(value.id));
    const recordingMs = Math.round(session.audio.durationMs(16000));
    if (recordingMs - (state.recordingMs ?? 0) >= 200) publish({ recordingMs });
  });
  handle('mira:studio:finish', async (event, id: unknown) => {
    const session = sessions.process(event.sender.id, text(id, 'Session ID', 64));
    publish({ phase: 'transcribing' });
    try {
      const original = await transcribePcm(session.audio.flush(), session.controller.signal);
      if (!original.trim())
        throw new Error('No speech detected. Try again closer to the microphone.');
      await prepare(text(original, 'Transcript'), session);
    } catch (error) {
      if (!session.controller.signal.aborted) {
        publish({
          error:
            error instanceof MiraError && error.kind === 'stt_failed'
              ? error.message
              : 'Transcription failed or no speech was detected. Your previous draft is preserved.',
        });
      }
    } finally {
      metadata.delete(session.id);
      if (sessions.release(session.id)) publish({ phase: 'idle', sessionId: null });
    }
  });
  handle('mira:studio:cancel', (event, id: unknown) => {
    const sessionId = text(id, 'Session ID', 64);
    sessions.cancel(event.sender.id, sessionId);
    metadata.delete(sessionId);
    publish({
      phase: 'idle',
      sessionId: null,
      error: null,
      notice: 'Recording cancelled. Your previous draft is preserved.',
    });
  });
  handle(
    'mira:studio:prepare',
    async (event, payload: unknown) => {
      const value = record(payload);
      const original = text(value.prompt, 'Prompt');
      const nextMode = voiceMode(value.mode);
      if (state.phase !== 'idle')
        throw new MiraError('action_invalid', 'Another operation is active');
      const session = sessions.begin(event.sender.id);
      metadata.set(session.id, {
        mode: nextMode,
        destination: Promise.resolve(null),
        context: selectedContext(),
        vocabulary: projectVocabulary(),
      });
      publish({
        phase: nextMode === 'refine' ? 'refining' : 'preparing',
        sessionId: session.id,
        error: null,
        notice: null,
      });
      try {
        await prepare(original, session);
      } catch (error) {
        if (!session.controller.signal.aborted) throw error;
      } finally {
        metadata.delete(session.id);
        if (sessions.release(session.id)) publish({ phase: 'idle', sessionId: null });
      }
    },
    ['workspace'],
  );
  handle(
    'mira:studio:refine',
    async (event, id: unknown) => {
      const draft = requireDraft(id);
      if (attempted.has(draft.id))
        throw new MiraError(
          'action_invalid',
          'Delivery was already attempted. Copy edits manually.',
        );
      const session = sessions.begin(event.sender.id);
      metadata.set(session.id, {
        mode: 'refine',
        destination: Promise.resolve(draft.destination),
        context: draft.context ?? [],
        vocabulary: draftVocabulary,
      });
      publish({ phase: 'refining', sessionId: session.id, error: null, notice: null });
      try {
        await prepare(draft.prompt, session, draft);
      } catch (error) {
        if (!session.controller.signal.aborted) throw error;
      } finally {
        metadata.delete(session.id);
        if (sessions.release(session.id)) publish({ phase: 'idle', sessionId: null });
      }
    },
    ['workspace'],
  );
  handle(
    'mira:studio:edit',
    (_event, payload: unknown) => {
      const value = record(payload);
      const draft = requireDraft(value.id);
      const prompt = text(value.prompt, 'Prompt');
      publish({
        draft: {
          ...draft,
          prompt,
          terminology: terminology(prompt),
          reviewWarnings: refinementLosses(draft.original, prompt),
          delivery: attempted.has(draft.id) ? 'attempted' : 'prepared',
          error: undefined,
        },
      });
    },
    ['workspace'],
  );
  handle(
    'mira:studio:correct',
    async (_event, payload: unknown) => {
      const value = record(payload);
      const draft = requireDraft(value.id);
      const scope = draftVocabulary;
      if (!scope || scope.projectId !== projectVocabulary()?.projectId)
        throw new MiraError(
          'action_invalid',
          'Reconnect the original project and enable vocabulary.',
        );
      if (typeof value.remember !== 'boolean')
        throw new MiraError('action_invalid', 'Choose whether to remember this pronunciation.');
      const suggestion = suggestTerms(draft.prompt, scope).find(
        (item) => item.id === value.suggestionId,
      );
      const file = text(value.path, 'Project file', 1024);
      if (!suggestion || !suggestion.candidates.includes(file))
        throw new MiraError('action_invalid', 'This suggestion changed. Review the current draft.');
      const symbolOrigins = suggestion.symbolFiles?.[file];
      if (symbolOrigins && value.remember)
        throw new MiraError(
          'action_invalid',
          'Saved pronunciations currently support filenames only.',
        );
      const prompt = text(
        draft.prompt.slice(0, suggestion.start) + file + draft.prompt.slice(suggestion.end),
        'Prompt',
      );
      publish({ phase: 'delivering' });
      try {
        const current = symbolOrigins
          ? (await contextUnchanged(draft.context ?? [])) &&
            (
              await Promise.all(
                symbolOrigins.map((origin) => vocabularyFileCurrent(scope.projectId, origin)),
              )
            ).every(Boolean)
          : await vocabularyFileCurrent(scope.projectId, file);
        if (!current || scope.projectId !== projectVocabulary()?.projectId)
          throw new MiraError(
            'action_invalid',
            'Project files changed. Refresh the index, reattach files, and prepare a new draft.',
          );
        if (value.remember) await rememberAlias(scope.projectId, suggestion.phrase, file);
        publish({
          draft: {
            ...draft,
            prompt,
            terminology: terminology(prompt),
            reviewWarnings: refinementLosses(draft.original, prompt),
            delivery: attempted.has(draft.id) ? 'attempted' : 'prepared',
            error: undefined,
          },
        });
      } finally {
        publish({ phase: 'idle' });
      }
    },
    ['workspace'],
  );
  handle(
    'mira:studio:copy',
    async (_event, id: unknown) => {
      const draft = requireDraft(id);
      publish({ phase: 'delivering' });
      try {
        if (draft.context?.length && !(await contextUnchanged(draft.context)))
          throw new MiraError(
            'action_invalid',
            'Attached context changed. Reattach files and prepare a new draft.',
          );
        await clipboard.writeText(formatPrompt(draft.prompt, draft.context));
        publish({
          draft: { ...draft, delivery: attempted.has(draft.id) ? 'attempted' : 'copied' },
        });
      } finally {
        publish({ phase: 'idle' });
      }
    },
    ['workspace'],
  );
  handle(
    'mira:studio:deliver',
    async (_event, id: unknown) => {
      const draft = requireDraft(id);
      if (attempted.has(draft.id))
        throw new MiraError(
          'action_invalid',
          'Delivery was already attempted. Check the destination before copying manually.',
        );
      if (!draft.destination)
        throw new MiraError(
          'action_invalid',
          'No supported destination was captured. Copy your prompt instead.',
        );
      attempted.add(draft.id);
      if (attempted.size > 100) attempted.delete(attempted.values().next().value!);
      publish({
        phase: 'delivering',
        draft: { ...draft, delivery: 'attempted', error: undefined },
      });
      try {
        if (draft.context?.length && !(await contextUnchanged(draft.context)))
          throw new MiraError('action_invalid', 'Attached context changed');
        await routeDevPrompt(formatPrompt(draft.prompt, draft.context), {
          destination: draft.destination,
        });
      } catch {
        publish({
          draft: {
            ...draft,
            delivery: 'attempted',
            error:
              'Delivery could not be verified. Check your destination before manually pasting; Mira will not retry.',
          },
        });
      } finally {
        publish({ phase: 'idle' });
      }
    },
    ['workspace'],
  );
  handle(
    'mira:studio:discard',
    (_event, id: unknown) => {
      requireDraft(id);
      draftVocabulary = null;
      publish({ draft: null, error: null });
    },
    ['workspace'],
  );
}
