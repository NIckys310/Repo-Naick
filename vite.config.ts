import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { handleHealth, handleInfo, handleSearch } from './api/_youtube.ts';

/**
 * En producción, Vercel publica los archivos de /api como funciones.
 * En desarrollo, este plugin atiende esas mismas rutas con el mismo código,
 * leyendo YOUTUBE_API_KEY de .env.local, para no depender de "vercel dev".
 */
function localApi(apiKey: string | undefined): Plugin {
  const routes: Record<string, (request: Request) => Response | Promise<Response>> = {
    '/api/search': (request) => handleSearch(request, apiKey),
    '/api/info': (request) => handleInfo(request, apiKey),
    '/api/health': () => handleHealth(apiKey),
  };
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const handler = routes[url.pathname];
    if (!handler) return next();
    const headers = new Headers();
    const site = req.headers['sec-fetch-site'];
    if (typeof site === 'string') headers.set('sec-fetch-site', site);
    void Promise.resolve(handler(new Request(url, { headers }))).then(async (response) => {
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    });
  };
  return {
    name: 'local-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), localApi(env.YOUTUBE_API_KEY || undefined)],
    build: { outDir: 'dist' },
    test: {
      // Solo las pruebas de este proyecto (la carpeta guía antigua queda fuera).
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
