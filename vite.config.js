import { defineConfig } from 'vite';

// Root development server. The frozen legacy demo is served from
// http://localhost:5173/legacy/dice/ until the new apps replace it.
//
// `vite preview` serves the built `dist/` tree. To preview the production
// build under its GitHub Pages base path, set BASE_PATH before previewing,
// for example: `BASE_PATH=/dice-playground/ npm run preview`. Dev servers
// leave BASE_PATH unset and keep the default `/` base.
export default defineConfig({
  root: '.',
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 5173,
    strictPort: true
  }
});
