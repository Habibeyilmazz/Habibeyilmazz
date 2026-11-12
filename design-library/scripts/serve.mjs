#!/usr/bin/env node
// Zero-dependency static server for the repo root. `/` -> /site/
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4610;
const HOST = process.env.HOST || '127.0.0.1';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  if (pathname === '/') { res.writeHead(302, { Location: '/site/' }).end(); return; }

  let file = normalize(join(ROOT, pathname));
  if (file !== ROOT && !file.startsWith(ROOT + '/')) { res.writeHead(403).end('Forbidden'); return; }
  try {
    let st = statSync(file);
    if (st.isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }).end(); return; }
      file = join(file, 'index.html'); st = statSync(file);
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      // Local tool: always fresh data, but let the browser revalidate big PNGs cheaply.
      'Cache-Control': extname(file) === '.png' ? 'no-cache' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found: ' + pathname);
  }
});

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is busy. Try: PORT=4611 npm start` : e.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => console.log(`Design Library -> http://localhost:${PORT}  (Ctrl+C to stop)`));
