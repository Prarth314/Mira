import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(command === 'serve'
      ? [
          {
            name: 'development-csp',
            transformIndexHtml: (html: string) =>
              html.replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:5173"),
          },
        ]
      : []),
  ],
  base: './',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        overlay: path.resolve(import.meta.dirname, 'overlay.html'),
      },
    },
  },
}));
