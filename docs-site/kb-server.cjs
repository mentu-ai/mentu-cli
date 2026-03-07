#!/usr/bin/env node
/**
 * Knowledge Base Static File Server
 * Serves the Astro-built documentation site
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.KB_PORT || '3457', 10);
const BASE_PATH = process.env.KB_BASE_PATH || '/knowledge-base';
const DIST_DIR = path.resolve(process.env.KB_DIST_DIR || path.join(__dirname, 'dist'));

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
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Strip base path if present
  if (urlPath.startsWith(BASE_PATH)) {
    urlPath = urlPath.slice(BASE_PATH.length) || '/';
  }

  // Default to index.html
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  // Try the exact path first
  let filePath = path.join(DIST_DIR, urlPath);

  // If path doesn't have extension and doesn't exist, try adding /index.html
  if (!path.extname(filePath)) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    }
  }

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Forbidden</h1>');
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Knowledge Base server running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${DIST_DIR}`);
  console.log(`Base path: ${BASE_PATH}`);
});
