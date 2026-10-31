import React, { useEffect, useState } from 'react';
import type { Draft } from '../src/types/studio';
import { refinementLosses } from '../src/main/refinement-policy';

export default function TerminologyReview({
  draft,
  review,
  disabled,
  run,
}: {
  draft: Draft;
  review: string;
  disabled: boolean;
  run: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  const [ignored, setIgnored] = useState<string[]>([]);
  const [remember, setRemember] = useState(false);
  const [undo, setUndo] = useState<{ id: string; prompt: string } | null>(null);
  useEffect(() => {
    setIgnored([]);
    setUndo(null);
    setRemember(false);
  }, [draft.id]);
  const dirty = review !== draft.prompt;
  const warnings = refinementLosses(draft.original, review);
  const suggestions =
    draft.terminology?.suggestions.filter((item) => !ignored.includes(item.id)) ?? [];

  return (
    <div className="terminology-review">
      {draft.terminology && (
        <section aria-label="Project-aware review" className="terminology-panel">
          <strong>Project-aware review · {draft.terminology.projectName}</strong>
          <p>
            Local filename and symbol suggestions. Choose the intended reference; your original
            stays below.
          </p>
          {dirty ? (
            <button
              className="secondary-button"
              disabled={disabled || !review.trim()}
              onClick={() => {
                void run(() => window.mira!.studio.edit(draft.id, review));
              }}
            >
              Refresh term suggestions
            </button>
          ) : (
            <>
              {suggestions.some((item) => item.source !== 'symbol') && (
                <label className="vocabulary-toggle">
                  <input
                    type="checkbox"
                    checked={remember}
                    disabled={disabled}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  Remember accepted pronunciations for this project
                </label>
              )}
              {!suggestions.length && (
                <p>
                  No pending term suggestions. This checks known spoken forms, not general speech
                  accuracy.
                </p>
              )}
              {suggestions.map((suggestion) => (
                <div className="term-suggestion" key={suggestion.id}>
                  <p>
                    <q>{suggestion.phrase}</q>{' '}
                    {suggestion.source === 'alias'
                      ? '· saved pronunciation'
                      : suggestion.source === 'symbol'
                        ? '· declaration match'
                        : '· filename match'}
                    {suggestion.candidates.length > 1 ? ' · ambiguous: choose a reference' : ''}
                  </p>
                  <div className="term-actions">
                    {suggestion.candidates.map((file) => (
                      <button
                        key={file}
                        className="secondary-button"
                        disabled={disabled}
                        aria-label={`Use ${file} for ${suggestion.phrase}`}
                        onClick={() => {
                          void run(async () => {
                            await window.mira!.studio.correct(
                              draft.id,
                              suggestion.id,
                              file,
                              remember && !suggestion.symbolFiles?.[file],
                            );
                            setUndo({ id: draft.id, prompt: draft.prompt });
                          });
                        }}
                      >
                        <span>
                          {file}
                          {suggestion.symbolFiles?.[file] && (
                            <small className="symbol-origin">
                              {suggestion.symbolFiles[file].join(', ')}
                            </small>
                          )}
                        </span>
                      </button>
                    ))}
                    <button
                      className="text-button"
                      disabled={disabled}
                      aria-label={`Keep original ${suggestion.phrase}`}
                      onClick={() => setIgnored((items) => [...items, suggestion.id])}
                    >
                      Keep original
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {undo?.id === draft.id && (
            <div>
              <button
                className="text-button"
                disabled={disabled || dirty}
                onClick={() => {
                  void run(async () => {
                    await window.mira!.studio.edit(draft.id, undo.prompt);
                    setUndo(null);
                  });
                }}
              >
                Undo last correction
              </button>
              <p>
                Undo restores draft text. Remove any saved pronunciation in Project pronunciations.
              </p>
            </div>
          )}
        </section>
      )}
      {!!warnings.length && (
        <div className="constraint-warning" role="status">
          <strong>Check changed details</strong>
          <p>
            These original details may be missing: {warnings.join(', ')}. Changes can be
            intentional; verify them before sharing.
          </p>
        </div>
      )}
    </div>
  );
}
