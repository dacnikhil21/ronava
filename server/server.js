import http from 'node:http';
import { handleApiRequest } from './api.js';
import { initDatabase } from './db.js';

// Initialize SQLite database tables
try {
  initDatabase();
  console.log('Database initialized successfully.');
} catch (err) {
  console.error('Database initialization error:', err);
}

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
