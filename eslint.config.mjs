import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'vendor/**', 'dist/**', 'dist-electron/**', 'release/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  { files: ['public/pcm-worklet.js'], languageOptions: { globals: { AudioWorkletProcessor: 'readonly', registerProcessor: 'readonly' } } },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['*.js', '**/*.mjs'],
    languageOptions: { globals: { require: 'readonly', process: 'readonly', console: 'readonly', fetch: 'readonly', AbortSignal: 'readonly', Buffer: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
