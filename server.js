const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch {}
}
loadEnv();

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/study') {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return sendJson(res, 503, { error: 'Add your real Gemini API key to task 3/.env (replace your_gemini_api_key_here), then restart the server.' });
    }
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 24_000) req.destroy(); });
    req.on('end', async () => {
      try {
        const input = JSON.parse(body || '{}');
        const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
        const mode = ['explain', 'summarize', 'quiz', 'flashcards'].includes(input.mode) ? input.mode : 'explain';
        if (!prompt) return sendJson(res, 400, { error: 'Add a topic or question to get started.' });
        if (prompt.length > 12_000) return sendJson(res, 413, { error: 'That’s a lot of material. Please keep your prompt under 12,000 characters.' });
        const instructions = {
          explain: 'Teach this topic clearly to a student. Start with the core idea, build up step by step, use a concrete example, and end with a short recap. Use headings and bullets where helpful.',
          summarize: 'Summarize these notes into the most important ideas. Use concise headings and bullets, define key terms, and end with a one-sentence takeaway.',
          quiz: 'Create a 5-question quiz from this material. Mix multiple choice and short answer. Put a clearly labeled answer key after all questions, with brief explanations.',
          flashcards: 'Create 8 useful study flashcards from this material. Format each as **Q:** question followed by **A:** answer. Focus on important concepts and recall.'
        };
        const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.6-flash')}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: 'You are Study Spark, a supportive, accurate study coach. Help students understand and remember. Be clear, encouraging, and honest if the material is ambiguous. ' + instructions[mode] }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } }),
          signal: AbortSignal.timeout(60_000)
        });
        const data = await upstream.json();
        if (!upstream.ok) {
          const message = data?.error?.message || 'Gemini could not complete that request.';
          return sendJson(res, upstream.status === 429 ? 429 : 502, { error: message });
        }
        const answer = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
        if (!answer) return sendJson(res, 502, { error: 'Gemini returned an empty response. Please try again or rephrase your prompt.' });
        return sendJson(res, 200, { answer });
      } catch (error) {
        if (error instanceof SyntaxError) return sendJson(res, 400, { error: 'The request could not be read. Please try again.' });
        if (error.name === 'TimeoutError') return sendJson(res, 504, { error: 'The response took too long. Please try again.' });
        return sendJson(res, 502, { error: 'Could not reach Gemini. Check your connection and try again.' });
      }
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' });
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.resolve(root, 'public', '.' + pathname);
  if (!file.startsWith(path.resolve(root, 'public') + path.sep)) return sendJson(res, 403, { error: 'Forbidden.' });
  fs.readFile(file, (error, content) => {
    if (error) return sendJson(res, 404, { error: 'Page not found.' });
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});
let activePort = port;
function tryNextPort() {
  if (activePort >= 65535) {
    console.error('Could not find an available port for Study Spark.');
    process.exitCode = 1;
    return;
  }
  activePort += 1;
  console.log(`Port ${activePort - 1} is already in use; trying ${activePort}...`);
  server.listen(activePort);
}

server.on('error', error => {
  if (error.code !== 'EADDRINUSE') {
    console.error('Could not start Study Spark:', error.message);
    process.exitCode = 1;
    return;
  }

  const probe = http.get({ host: '127.0.0.1', port: activePort, path: '/' }, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => {
      if (body.includes('<title>Study Spark')) {
        console.log(`Study Spark is already running at http://localhost:${activePort}`);
        return;
      }
      tryNextPort();
    });
  });
  probe.setTimeout(1500, () => probe.destroy());
  probe.on('error', tryNextPort);
});
server.on('listening', () => console.log(`Study Spark is ready at http://localhost:${activePort}`));
server.listen(activePort);
