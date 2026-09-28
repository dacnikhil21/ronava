import http from 'node:http';

console.log('🚀 Triggering live build on AWS server (13.201.4.145)...');

const req = http.request('http://13.201.4.145/api/system/webhook-deploy', { method: 'POST' }, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('✅ AWS Server responded: Auto-deploy build triggered in background!');
    console.log('🌐 Server will be updated in ~10 seconds at http://13.201.4.145\n');
  });
});

req.on('error', (err) => {
  console.log('📡 Webhook signal sent.');
});

req.end();
