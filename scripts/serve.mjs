// Local dev server (no dependencies):  npm run dev   ->  http://127.0.0.1:8765/
//
// Serves what `npm run build` would publish, but built fresh on every request (edit src/, refresh the browser):
//   /                   the standalone/iframe page, real Google API
//   /?test              same with built-in test data (also works on the published site; see README.md)
//   /test.html?test     embed test page: component directly + iframe with auto-height
//
// The real API only answers from referrers allowed on the key (localhost/* and 127.0.0.1/* are; use ?test otherwise).
import http from 'node:http';
import { build } from './build.mjs';

const PORT = Number(process.env.PORT) || 8765;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  const name = new URL(req.url, 'http://x').pathname.replace(/^\/$/, '/index.html').slice(1);
  try {
    const { files } = build();
    if (Object.hasOwn(files, name)) {
      res.writeHead(200, { 'Content-Type': TYPES[name.slice(name.lastIndexOf('.'))], 'Cache-Control': 'no-store' });
      return res.end(files[name]);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build failed: ' + e.message);
  }
}).listen(PORT, '127.0.0.1', () => console.log('Dev server: http://127.0.0.1:' + PORT + '/   (?test for test data, /test.html?test for the embed test)'));
