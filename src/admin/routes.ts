import { Router, Request, Response } from 'express';
import { requireAdminBasicAuth } from './auth.js';
import { listConversations, getConversation } from '../models/conversations.js';
import { getMessagesForConversation } from '../models/messages.js';
import { checkDatabaseHealth } from '../db.js';

export const adminRouter = Router();

adminRouter.use(requireAdminBasicAuth);

adminRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Check database health first
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      return res.status(503).send('Database connection unavailable. Check POSTGRES_URL environment variable.');
    }

    const q = (req.query.q as string) || '';
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);
    const { items, total } = await listConversations(limit, offset, q);
    res.render('conversations', { items, total, q, limit, offset });
  } catch (err: any) {
    console.error('Admin GET / error:', err?.message || err);
    res.status(500).send(`Error: ${err?.message || 'Unknown error'}`);
  }
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
