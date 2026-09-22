import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function apiPlugin() {
  return {
    name: 'ronav-api-middleware',
    async configureServer(server) {
      const { handleApiRequest } = await import('./server/api.js');
      const { initPostgresSchema } = await import('./server/pg_db.js');
      initPostgresSchema().catch(() => {});
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          await handleApiRequest(req, res);
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 3000,
    host: true
  }
});
