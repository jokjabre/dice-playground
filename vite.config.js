import { defineConfig } from 'vite';

// Root development server. The frozen legacy demo is served from
// http://localhost:5173/legacy/dice/ until the new apps replace it.
export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 5173,
    strictPort: true
  }
});
