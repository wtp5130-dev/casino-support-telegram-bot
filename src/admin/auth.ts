import auth from 'basic-auth';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function requireAdminBasicAuth(req: Request, res: Response, next: NextFunction) {
  const creds = auth(req);
  if (!creds || creds.name !== config.ADMIN_USER || creds.pass !== config.ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required');
  }
  next();
}
