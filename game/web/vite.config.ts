import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The web UI imports the shared engine from ../core, ../cards, ../simulation and the ruleset JSON from ../../rules.
const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { fs: { allow: [root] } },
});
