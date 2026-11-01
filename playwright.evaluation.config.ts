import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testIgnore: [],
  projects: [
    { name: 'speech', testMatch: '**/speech.spec.ts' },
    { name: 'performance', testMatch: '**/performance.spec.ts' },
    { name: 'native', testMatch: '**/native-delivery.spec.ts' },
  ],
});
