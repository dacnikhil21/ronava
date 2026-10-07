import 'dotenv/config';
import http from 'node:http';
import { handleApiRequest } from './api.js';
import { initPostgresSchema } from './pg_db.js';

// Initialize PostgreSQL connection
initPostgresSchema()
  .then((ok) => {
    if (ok) console.log('[Server] Connected to live PostgreSQL database.');
    else console.warn('[Server] PostgreSQL connection check returned false.');
  })
  .catch((err) => {
    console.error('[Server] PostgreSQL initialization error:', err);
  });

const server = http.createServer(async (req, res) => {
  if (req.url && req.url.startsWith('/api/')) {
    await handleApiRequest(req, res);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'RONAV Technologies API Server' }));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`RONAV API Server is running on port ${PORT}`);
});
