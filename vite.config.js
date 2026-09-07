import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server/api.js';
import { checkSupabaseConnection } from './server/supabase.js';

function apiPlugin() {
  return {
    name: 'ronav-api-middleware',
    configureServer(server) {
      checkSupabaseConnection().catch(() => {});
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
