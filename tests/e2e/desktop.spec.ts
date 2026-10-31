import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

test('production build opens with an isolated preload and settings bridge', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'mira-e2e-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, NODE_ENV: 'production' }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.MIRA_TEST_EXECUTABLE;
  const app = await electron.launch({
    executablePath,
    args: [
      ...(executablePath ? [] : ['.']),
      `--user-data-dir=${profile}`,
      '--use-fake-device-for-media-stream',
    ],
    env,
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1200, 1400),
    );
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    // Synthetic hardware only: unlike the capture test, permissions are NOT auto-granted.
    const cameraDenied = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        return false;
      } catch {
        return true;
      }
    });
    expect(cameraDenied).toBe(true);
    const workspaceAccessibility = await new AxeBuilder({ page })
      .setLegacyMode()
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      workspaceAccessibility.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
    const bridge = await page.evaluate(async () => ({
      keys: await window.mira?.keys.status(),
      settings: await window.mira?.settings.get(),
      node: typeof (globalThis as Record<string, unknown>).require,
    }));
    expect(bridge.keys).toEqual({ anthropic: false, openai: false });
    expect(bridge.settings?.defaultProvider).toBe('anthropic');
    expect(bridge.node).toBe('undefined');
    await page.getByLabel('Prefer to type?').fill('Add regression tests for expired sessions.');
    await page.getByRole('button', { name: 'Prepare instruction' }).click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue(
      'Add regression tests for expired sessions.',
    );
    await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    await expect(page.getByText('Copied. Paste it wherever you are working.')).toBeVisible();
    const copy = await app.evaluate(async ({ clipboard }) => clipboard.readText());
    expect(copy).toBe('Add regression tests for expired sessions.');
    await page.screenshot({ path: 'test-results/workspace.png', fullPage: true });
    const invalidProviderRejected = await page.evaluate(async () => {
      try {
        await window.mira!.provider.set('unknown' as 'openai');
        return false;
      } catch {
        return true;
      }
    });
    expect(invalidProviderRejected).toBe(true);
    await page.getByRole('button', { name: 'Discard draft' }).click();
    await expect(page.getByLabel('Prepared prompt')).toHaveCount(0);
    const project = path.join(profile, 'project');
    await mkdir(project);
    await writeFile(path.join(project, 'auth.ts'), 'export const sessionTTL = 300;');
    await mkdir(path.join(project, 'hooks'));
    await mkdir(path.join(project, 'other'));
    await writeFile(path.join(project, 'hooks', 'useStudio.ts'), 'export const studio = true;');
    await writeFile(path.join(project, 'other', 'useStudio.ts'), 'export const alternate = true;');
    await writeFile(path.join(project, '.env'), 'PRIVATE=do-not-share');
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
    }, project);
    await page.getByRole('button', { name: 'Connect project' }).click();
    await page.getByText('Choose files to attach').click();
    await page.getByRole('checkbox', { name: 'auth.ts' }).click();
    await expect(page.getByRole('checkbox', { name: 'auth.ts' })).toBeChecked();
    await page.getByRole('button', { name: 'Prepare instruction' }).click();
    await expect(page.getByText('Attached context · 1 files')).toBeVisible();
    await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    await expect(
      page.getByText('Copied. Paste it wherever you are working.', { exact: true }),
    ).toBeVisible();
    const contextualCopy = await app.evaluate(async ({ clipboard }) => clipboard.readText());
    expect(contextualCopy).toContain('export const sessionTTL = 300;');
    expect(contextualCopy).not.toContain('PRIVATE=');
    expect(
      await page.evaluate(async () => (await window.mira!.studio.state()).draft!.terminology),
    ).toBeUndefined();
    await page.getByLabel('Project-aware dictation', { exact: true }).check();
    await page
      .getByLabel('Prefer to type?')
      .fill('Fix use studio dot tee ess, but do not change 300.');
    await page.getByRole('button', { name: 'Prepare instruction' }).click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue(
      'Fix use studio dot tee ess, but do not change 300.',
    );
    const terms = page.getByRole('region', { name: 'Project-aware review' });
    await expect(terms.getByText('ambiguous: choose a reference', { exact: false })).toBeVisible();
    const vocabularyAccessibility = await new AxeBuilder({ page })
      .setLegacyMode()
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      vocabularyAccessibility.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
    await page.screenshot({ path: 'test-results/project-aware-review.png', fullPage: true });
    await terms.screenshot({ path: 'test-results/project-aware-terms.png' });
    await terms.getByLabel('Remember accepted pronunciations for this project').check();
    await terms
      .getByRole('button', {
        name: 'Use hooks/useStudio.ts for use studio dot tee ess',
        exact: true,
      })
      .click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue(
      'Fix hooks/useStudio.ts, but do not change 300.',
    );
    await terms.getByRole('button', { name: 'Undo last correction' }).click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue(
      'Fix use studio dot tee ess, but do not change 300.',
    );
    // Explicit memory remains visible and removable even after undoing draft text.
    await page.getByText('Project pronunciations · 1 saved').click();
    await expect(
      page.getByRole('button', {
        name: 'Remove pronunciation use studio dot tee ess',
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel('Spoken phrase', { exact: true }).fill('my recorder');
    await page.getByLabel('Vocabulary file', { exact: true }).selectOption('hooks/useStudio.ts');
    await page.getByRole('button', { name: 'Save pronunciation', exact: true }).click();
    await page.getByLabel('Prefer to type?').fill('Fix my recorder without changing 300.');
    await page.getByRole('button', { name: 'Prepare instruction' }).click();
    const suggestion = await page.evaluate(
      async () => (await window.mira!.studio.state()).draft!.terminology!.suggestions[0],
    );
    const forgedRejected = await page.evaluate(async (id) => {
      const draft = (await window.mira!.studio.state()).draft!;
      try {
        await window.mira!.studio.correct(draft.id, id, '.env', false);
        return false;
      } catch {
        return true;
      }
    }, suggestion.id);
    expect(forgedRejected).toBe(true);
    const staleRejected = await page.evaluate(async (id) => {
      const draft = (await window.mira!.studio.state()).draft!;
      await window.mira!.studio.edit(draft.id, `Now ${draft.prompt}`);
      try {
        await window.mira!.studio.correct(draft.id, id, 'hooks/useStudio.ts', false);
        return false;
      } catch {
        return true;
      }
    }, suggestion.id);
    expect(staleRejected).toBe(true);
    await terms
      .getByRole('button', { name: 'Use hooks/useStudio.ts for my recorder', exact: true })
      .click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue(
      'Now Fix hooks/useStudio.ts without changing 300.',
    );
    await page.getByLabel('Prepared prompt').fill('Fix hooks/useStudio.ts while changing 300.');
    await expect(
      page.getByText('These original details may be missing: negation.', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    await expect(
      page.getByText('Copied. Paste it wherever you are working.', { exact: true }),
    ).toBeVisible();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain(
      'Fix hooks/useStudio.ts while changing 300.',
    );
    await page.getByRole('button', { name: 'Disconnect project' }).click();
    await page.getByRole('button', { name: 'Connect project' }).click();
    await expect(page.getByLabel('Project-aware dictation', { exact: true })).not.toBeChecked();
    await page.getByLabel('Project-aware dictation', { exact: true }).check();
    await page.getByText('Project pronunciations · 2 saved').click();
    await page
      .getByRole('button', { name: 'Remove pronunciation my recorder', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Remove pronunciation my recorder', exact: true }),
    ).toHaveCount(0);
    await page.getByText('Choose files to attach', { exact: true }).click();
    await page.getByRole('checkbox', { name: 'auth.ts', exact: true }).click();
    await page
      .getByLabel('Prefer to type?')
      .fill('Change session t t l without changing permissions.');
    await page.getByRole('button', { name: 'Prepare instruction' }).click();
    await expect(
      terms.getByRole('button', { name: 'Use sessionTTL for session t t l', exact: true }),
    ).toBeVisible();
    await terms.screenshot({ path: 'test-results/project-symbol-review.png' });
    await terms
      .getByRole('button', { name: 'Use sessionTTL for session t t l', exact: true })
      .click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue(
      'Change sessionTTL without changing permissions.',
    );
    await page.getByLabel('Prefer to type?').fill('Review session t t l.');
    await page.getByRole('button', { name: 'Prepare instruction' }).click();
    await expect(
      terms.getByRole('button', { name: 'Use sessionTTL for session t t l', exact: true }),
    ).toBeVisible();
    await writeFile(path.join(project, 'auth.ts'), 'export const sessionTimeout = 500;');
    await terms
      .getByRole('button', { name: 'Use sessionTTL for session t t l', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText('Project files changed');
    await page.getByRole('button', { name: 'Refresh index', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'auth.ts', exact: true })).not.toBeChecked();
    await page.getByRole('checkbox', { name: 'auth.ts', exact: true }).click();
    await page.getByLabel('Prefer to type?').fill('Review session timeout.');
    await page.getByRole('button', { name: 'Prepare instruction' }).click();
    await terms
      .getByRole('button', { name: 'Use sessionTimeout for session timeout', exact: true })
      .click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue('Review sessionTimeout.');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await page.getByText('Recovery & diagnostics').click();
    await page.getByRole('button', { name: 'View diagnostics' }).click();
    await expect(page.getByRole('button', { name: 'Copy diagnostic report' })).toBeVisible();
    const diagnostics = await page.evaluate(async () =>
      JSON.stringify(await window.mira!.diagnostics.get()),
    );
    expect(diagnostics).not.toContain(profile);
    expect(diagnostics).not.toContain('PRIVATE=');
    expect(diagnostics).not.toContain('expired sessions');
    const settingsAccessibility = await new AxeBuilder({ page })
      .setLegacyMode()
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      settingsAccessibility.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
