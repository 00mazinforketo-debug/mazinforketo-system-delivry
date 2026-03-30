import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { devTextEditorPlugin } from './dev-tools/text-editor-plugin';

const fullReloadOnExternalFiles = (watchTargets: string[]): Plugin => ({
  name: 'full-reload-on-external-files',
  configureServer(server) {
    const resolvedTargets = watchTargets.map((target) => path.resolve(__dirname, target));
    server.watcher.add(resolvedTargets);

    const isWatchedFile = (file: string) =>
      resolvedTargets.some((target) => {
        const relative = path.relative(target, file);
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
      });

    const triggerReload = (file: string) => {
      if (isWatchedFile(file)) {
        server.ws.send({ type: 'full-reload', path: '*' });
      }
    };

    server.watcher.on('change', triggerReload);
    server.watcher.on('add', triggerReload);
    server.watcher.on('unlink', triggerReload);
  },
});

export default defineConfig({
  plugins: [react(), devTextEditorPlugin(__dirname), fullReloadOnExternalFiles(['worker/src', 'shared', 'wrangler.jsonc'])],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 250,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
  },
});
