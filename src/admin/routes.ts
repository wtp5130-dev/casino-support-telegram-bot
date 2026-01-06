import { Router, Request, Response } from 'express';
import { requireAdminBasicAuth } from './auth.js';
import { listConversations, getConversation } from '../models/conversations.js';
import { getMessagesForConversation } from '../models/messages.js';
import { checkDatabaseHealth } from '../db.js';

export const adminRouter = Router();

adminRouter.use(requireAdminBasicAuth);

adminRouter.get('/', async (req: Request, res: Response) => {
  try {
    console.log('Admin route hit: GET /admin');
    // Check database health first
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      return res.status(503).send('Database connection unavailable. Check POSTGRES_URL environment variable.');
    }

    const q = (req.query.q as string) || '';
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    // Enforce a hard timeout on the DB query to avoid 504s
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 5000));
    const data = await Promise.race([
      (async () => {
        const { items, total } = await listConversations(limit, offset, q);
        return { items, total };
      })(),
      timeoutPromise,
    ]);

    // @ts-ignore - data will be set if no timeout
    res.render('conversations', { items: data.items, total: data.total, q, limit, offset });
  } catch (err: any) {
    console.error('Admin GET / error:', err?.message || err);
    res.status(500).send(`Error: ${err?.message || 'Unknown error'}`);
  }
});

// Lightweight ping for diagnostics
adminRouter.get('/ping', (_req: Request, res: Response) => {
  res.type('text/plain').send('ok');
});

adminRouter.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const convo = await getConversation(id);
    if (!convo) return res.status(404).send('Not found');
    const messages = await getMessagesForConversation(id);
    res.render('conversation', { convo, messages });
  } catch (err: any) {
    console.error('Admin GET /conversations/:id error:', err?.message || err);
    res.status(500).send(`Error: ${err?.message || 'Unknown error'}`);
  }
});

// API
adminRouter.get('/api/conversations', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);
    const { items, total } = await listConversations(limit, offset, q);
    res.json({ items, total });
  } catch (err: any) {
    console.error('Admin GET /api/conversations error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});

adminRouter.get('/api/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const convo = await getConversation(id);
    if (!convo) return res.status(404).json({ error: 'Not found' });
    const messages = await getMessagesForConversation(id);
    res.json(messages);
  } catch (err: any) {
    console.error('Admin GET /api/conversations/:id/messages error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});
