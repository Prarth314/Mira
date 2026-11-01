import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/speech.spec.ts', '**/performance.spec.ts', '**/native-delivery.spec.ts'],
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
});
