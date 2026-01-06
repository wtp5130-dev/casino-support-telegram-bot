import serverless from 'serverless-http';
import { app, init, handleWebhook } from '../src/app.js';
import auth from 'basic-auth';

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
  return creds && creds.name === process.env.ADMIN_USER && creds.pass === process.env.ADMIN_PASS;
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
          BASE_URL: process.env.BASE_URL || 'not set',
          NODE_ENV: process.env.NODE_ENV,
        }));
      } else {
        res.end(JSON.stringify({ ok: true }));
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
