import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Tauri expect a fixed port, fail if that port is not available
  server: {
    port: 5173,
    strictPort: true,
  },
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // to make use of `import.meta.env.TAURI_PLATFORM` and other env variables
  // https://tauri.app/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri supports esbuild's target, and since we're on Windows primarily, we target chrome105
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
