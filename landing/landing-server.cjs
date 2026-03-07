#!/usr/bin/env node
/**
 * Mentu Landing Page Server
 * Serves static files for the landing page
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.LANDING_PORT || '3458', 10);
const DIST_DIR = path.resolve(process.env.LANDING_DIR || __dirname);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // Serve index.html for root
  if (url === '/' || url === '') {
    url = '/index.html';
  }

  const filePath = path.join(DIST_DIR, url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Mentu Landing Server: http://localhost:${PORT}`);
  console.log(`  Serving: ${DIST_DIR}`);
});
