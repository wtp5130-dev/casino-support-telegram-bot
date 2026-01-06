import serverless from 'serverless-http';
// After tsc compiles, both api and src go to dist/
// So from dist/api/index.js, ../src/app.js is actually dist/src/app.js
import app, { init } from '../src/app.js';

const appHandler = serverless(app);

export default async function(req: any, res: any) {
  console.log('Serverless handler invoked', { path: req?.url, method: req?.method });
  try {
    // Allow health and lightweight diagnostics to respond even if env not fully configured
    if (req?.url && (req.url.startsWith('/health') || req.url.startsWith('/admin/ping'))) {
      console.log('Health check request');
      return appHandler(req, res);
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
