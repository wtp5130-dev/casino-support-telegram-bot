import serverless from 'serverless-http';
// After tsc compiles, both api and src go to dist/
// So from dist/api/index.js, ../src/app.js is actually dist/src/app.js
import { app, init } from '../src/app.js';

const appHandler = serverless(app);

export default async function(req: any, res: any) {
  try {
    // Allow health to respond even if env not fully configured
    if (req?.url && req.url.startsWith('/health')) {
      return appHandler(req, res);
    }
    try {
      await init();
    } catch (e: any) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: e?.message || 'Init failed' }));
      return;
    }
    return appHandler(req, res);
  } catch (err: any) {
    console.error('Serverless handler error:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: err?.message || 'Server error' }));
  }
}
