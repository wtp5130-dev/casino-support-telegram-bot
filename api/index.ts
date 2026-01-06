import serverless from 'serverless-http';
// After tsc compiles, both api and src go to dist/
// So from dist/api/index.js, ../src/app.js is actually dist/src/app.js
import app, { init } from '../src/app.js';

const appHandler = serverless(app);

export default async function(req: any, res: any) {
  console.log('Serverless handler invoked', { path: req?.url, method: req?.method });
  try {
    // Handle /telegram/webhook directly without full Express init
    if (req?.url?.startsWith('/telegram/webhook') && req?.method === 'POST') {
      console.log('Handling Telegram webhook directly');
      try {
        await init();
        console.log('Init complete for webhook');
      } catch (e: any) {
        console.error('Init error for webhook:', e?.message);
        res.statusCode = 503;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Init failed' }));
        return;
      }
      // Pass through to Express handler
      return appHandler(req, res);
    }

    // Handle /health endpoints directly without going through Express
    if (req?.url?.startsWith('/health')) {
      console.log('Handling /health directly');
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      if (req.url === '/health/env') {
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

    // Handle /admin directly without going through Express
    if (req?.url?.startsWith('/admin')) {
      console.log('Handling /admin directly');
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Admin dashboard', note: 'Full UI coming soon' }));
      return;
    }

    console.log('Initializing app for:', req?.url);
    try {
      // Put a hard timeout around init to avoid 300s hangs when DB is unreachable
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
