import auth from 'basic-auth';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function requireAdminBasicAuth(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('Admin auth check for', req.path);
    const creds = auth(req);
    if (!creds || creds.name !== config.ADMIN_USER || creds.pass !== config.ADMIN_PASS) {
      res.set('WWW-Authenticate', 'Basic realm="Admin"');
      console.log('Admin auth challenge issued');
      return res.status(401).send('Authentication required');
    }
    console.log('Admin auth success');
    next();
  } catch (err: any) {
    console.error('Auth error:', err?.message || err);
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication failed');
  }
}
