import serverless from 'serverless-http';
import { app, init, handleWebhook } from '../src/app.js';
import auth from 'basic-auth';
import { listConversations, getConversation } from '../src/models/conversations.js';
import { getMessagesForConversation } from '../src/models/messages.js';
import { countKBChunks } from '../src/rag/store.js';

const appHandler = serverless(app);

// Helper to read and parse request body
async function readBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Helper to check admin auth
function checkAdminAuth(req: any): boolean {
  const creds = auth(req);
  return !!(creds && creds.name === process.env.ADMIN_USER && creds.pass === process.env.ADMIN_PASS);
}

// Helper to render HTML conversations list
async function renderConversationsList(query?: string): Promise<string> {
  const q = query || '';
  const limit = 25;
  const offset = 0;
  const { items, total } = await listConversations(limit, offset, q);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Admin - Casino Support Bot</title>
    <style>
      body { font-family: system-ui, Arial, sans-serif; margin: 0; padding: 0; background: #f7f7f7; }
      header { background: #222; color: #fff; padding: 12px 16px; }
      main { padding: 16px; max-width: 1000px; margin: 0 auto; }
      a { color: #0b73ff; text-decoration: none; }
      .badge { display: inline-block; padding: 2px 6px; font-size: 12px; border-radius: 4px; background: #e33; color: #fff; margin-left: 6px; }
      .card { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
      .muted { color: #666; }
      form.search { margin: 12px 0; }
      input, button { padding: 8px; font-size: 14px; }
      input { width: 300px; }
    </style>
  </head>
  <body>
    <header>
      <strong>Casino Support Admin Dashboard</strong>
    </header>
    <main>
      <h2>Conversations</h2>
      <form class="search" method="get">
        <input type="text" name="q" placeholder="Search chat_id, username, or text" value="${q}" />
        <button type="submit">Search</button>
      </form>
      <p class="muted">Total: ${total}</p>
      ${items.map((c: any) => `
        <div class="card">
          <div>
            <a href="/admin/conversations/${c.id}">#${c.id}</a>
            <span class="muted">chat_id:</span> ${c.chat_id}
            ${c.username ? `<span class="muted">@</span>${c.username}` : ''}
            ${c.rg_flag ? '<span class="badge">RG flag</span>' : ''}
          </div>
          <div class="muted">last seen: ${c.last_seen_at}</div>
          ${c.last_text ? `<div class="muted">last: ${(c.last_text || '').slice(0, 120)}</div>` : ''}
        </div>
      `).join('')}
    </main>
  </body>
</html>`;

  return html;
}

// Helper to render conversation detail page
async function renderConversationDetail(convoId: number): Promise<string> {
  const convo = await getConversation(convoId);
  if (!convo) {
    return `<!doctype html><html><body><h2>Not Found</h2><p>Conversation not found</p><a href="/admin">Back to conversations</a></body></html>`;
  }

  const messages = await getMessagesForConversation(convoId);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Conversation #${convo.id}</title>
    <style>
      body { font-family: system-ui, Arial, sans-serif; margin: 0; padding: 0; background: #f7f7f7; }
      header { background: #222; color: #fff; padding: 12px 16px; }
      main { padding: 16px; max-width: 900px; margin: 0 auto; }
      a { color: #0b73ff; }
      .badge { display: inline-block; padding: 2px 6px; font-size: 12px; border-radius: 4px; background: #e33; color: #fff; margin-left: 6px; }
      .info { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
      .muted { color: #666; }
      .thread { display: flex; flex-direction: column; gap: 8px; }
      .message { padding: 12px; border-radius: 8px; margin: 4px 0; }
      .in { background: #e8f0fe; }
      .out { background: #e6ffe8; }
      .msg-meta { font-size: 12px; color: #666; margin-bottom: 4px; }
      pre { margin: 8px 0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; }
    </style>
  </head>
  <body>
    <header>
      <strong>Casino Support Admin</strong>
    </header>
    <main>
      <a href="/admin">← Back to conversations</a>
      <h2>Conversation #${convo.id} ${convo.rg_flag ? '<span class="badge">RG flag</span>' : ''}</h2>
      <div class="info">
        <div class="muted">chat_id: ${convo.chat_id} ${convo.username ? `| @${convo.username}` : ''}</div>
        <div class="muted">platform: ${convo.platform} | last_seen: ${convo.last_seen_at}</div>
      </div>
      <h3>Messages</h3>
      <div class="thread">
        ${messages.map((m: any) => `
          <div class="message ${m.direction}">
            <div class="msg-meta">[${m.created_at}] <strong>${m.role}</strong> ${m.model ? `— ${m.model}` : ''}</div>
            <pre>${m.text}</pre>
            ${m.prompt_tokens || m.completion_tokens ? `<div class="muted">tokens: ${m.prompt_tokens}/${m.completion_tokens}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </main>
  </body>
</html>`;

  return html;
}

export default async function(req: any, res: any) {
  const urlPath = req?.url?.split('?')[0]; // Remove query string
  console.log('Serverless handler invoked', { path: urlPath, method: req?.method, timestamp: new Date().toISOString() });
  try {
    // Handle /telegram/webhook directly with manual body parsing
    if (urlPath?.startsWith('/telegram/webhook') && req?.method === 'POST') {
      console.log('[WEBHOOK] Handling Telegram webhook directly');
      try {
        console.log('[WEBHOOK] Calling init()');
        await init();
        console.log('[WEBHOOK] Init complete, reading body');
        const update = await readBody(req);
        console.log('[WEBHOOK] Body parsed successfully', { 
          message_id: update.message?.message_id, 
          chat_id: update.message?.chat?.id,
          text: update.message?.text?.substring(0, 50) 
        });
        
        // Respond immediately to Telegram (important: don't wait for processing)
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        console.log('[WEBHOOK] Response sent to Telegram');

        // Process async in background (don't await, don't block)
        if (update.message && update.message.text) {
          console.log('[WEBHOOK] Spawning async handler for message:', update.message.text);
          handleWebhook(update).then(
            () => console.log('[WEBHOOK] Handler completed successfully'),
            (e: any) => console.error('[WEBHOOK] Handler error:', e?.message || e)
          );
        }
      } catch (e: any) {
        console.error('[WEBHOOK] Error reading/parsing body:', e?.message || e, { stack: e?.stack?.substring(0, 200) });
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: e?.message }));
      }
      return;
    }

    // Handle /health endpoints directly without going through Express
    if (urlPath?.startsWith('/health')) {
      console.log('Handling /health directly');
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      if (urlPath === '/health/env') {
        res.end(JSON.stringify({
          POSTGRES_URL: !!process.env.POSTGRES_URL,
          OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
          TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
          ADMIN_USER: !!process.env.ADMIN_USER,
          ADMIN_PASS: !!process.env.ADMIN_PASS,
          CLICKUP_API_TOKEN: !!process.env.CLICKUP_API_TOKEN,
          CLICKUP_LIST_IDS: !!process.env.CLICKUP_LIST_IDS,
          CLICKUP_DOC_SHARE_URLS: !!process.env.CLICKUP_DOC_SHARE_URLS,
          CLICKUP_WORKSPACE_ID: !!process.env.CLICKUP_WORKSPACE_ID,
          CLICKUP_DOC_IDS: !!process.env.CLICKUP_DOC_IDS,
          BASE_URL: process.env.BASE_URL || 'not set',
          NODE_ENV: process.env.NODE_ENV,
        }));
      } else if (urlPath === '/health/kb') {
        try {
          await init();
          const count = await countKBChunks();
          res.end(JSON.stringify({ ok: true, kb_chunks: count }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: e?.message }));
        }
      } else {
        res.end(JSON.stringify({ ok: true }));
      }
      return;
    }

    // Handle /admin root endpoint
    if (urlPath === '/admin' || urlPath === '/admin/') {
      console.log('Handling /admin root');
      // Check auth
      if (!checkAdminAuth(req)) {
        res.statusCode = 401;
        res.setHeader('www-authenticate', 'Basic realm="Admin"');
        res.setHeader('content-type', 'text/plain');
        res.end('Unauthorized');
        return;
      }
      
      try {
        await init();
        const query = new URL(`http://localhost${req.url}`).searchParams.get('q');
        const html = await renderConversationsList(query || undefined);
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html');
        res.end(html);
      } catch (e: any) {
        console.error('Admin root error:', e?.message);
        res.statusCode = 500;
        res.setHeader('content-type', 'text/plain');
        res.end(`Error: ${e?.message}`);
      }
      return;
    }

    // Handle /admin/conversations/:id endpoint
    const convoMatch = urlPath?.match(/^\/admin\/conversations\/(\d+)$/);
    if (convoMatch) {
      console.log('Handling /admin/conversations/:id');
      // Check auth
      if (!checkAdminAuth(req)) {
        res.statusCode = 401;
        res.setHeader('www-authenticate', 'Basic realm="Admin"');
        res.setHeader('content-type', 'text/plain');
        res.end('Unauthorized');
        return;
      }

      try {
        await init();
        const convoId = Number(convoMatch[1]);
        const html = await renderConversationDetail(convoId);
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html');
        res.end(html);
      } catch (e: any) {
        console.error('Admin conversation detail error:', e?.message);
        res.statusCode = 500;
        res.setHeader('content-type', 'text/plain');
        res.end(`Error: ${e?.message}`);
      }
      return;
    }

    // Handle public admin endpoints directly (avoid Express routing hangs)
    if (urlPath?.startsWith('/admin/ping')) {
      console.log('Handling /admin/ping directly');
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain');
      res.end('ok');
      return;
    }

    if (urlPath?.startsWith('/admin/test')) {
      console.log('Handling /admin/test directly');
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Admin router works' }));
      return;
    }

    console.log('Initializing app for:', urlPath);
    try {
      const initTimeout = new Promise((_resolve, reject) => setTimeout(() => reject(new Error('Init timeout')), 4000));
      await Promise.race([init(), initTimeout]);
    } catch (e: any) {
      console.error('Init error:', e?.message || e);
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: e?.message || 'Init failed' }));
      return;
    }
    console.log('App initialized, handling request');
    return appHandler(req, res);
  } catch (err: any) {
    console.error('Serverless handler error:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: err?.message || 'Server error' }));
  }
}
