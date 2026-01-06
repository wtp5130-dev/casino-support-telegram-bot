import { Router, Request, Response } from 'express';
import { requireAdminBasicAuth } from './auth.js';
import { listConversations, getConversation } from '../models/conversations.js';
import { getMessagesForConversation } from '../models/messages.js';
import { checkDatabaseHealth } from '../db.js';

export const adminRouter = Router();

// Public lightweight ping for diagnostics (no auth)
adminRouter.get('/ping', (_req: Request, res: Response) => {
  res.type('text/plain').send('ok');
});

// Public test endpoint (no auth)
adminRouter.get('/test', (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'Admin router works' });
});

// Public fast-path responder for diagnostics: /admin?fast=1
adminRouter.use((req: Request, res: Response, next) => {
  if (req.path === '/' && (req.query.fast as string) === '1') {
    res.type('text/html').send('<h1>Admin reachable</h1><p>Route works. Add credentials and remove ?fast=1 to load data.</p>');
    return;
  }
  next();
});

// Require admin authentication
adminRouter.use(requireAdminBasicAuth);

adminRouter.get('/', async (req: Request, res: Response) => {
  try {
    console.log('Admin route hit: GET /admin');
    
    // Check database health
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Get page params
    const q = (req.query.q as string) || '';
    const page = Math.max(0, Number(req.query.page || 0));
    const limit = Math.min(100, Number(req.query.limit || 25));
    const offset = page * limit;

    // Fetch conversations
    const { items, total } = await listConversations(limit, offset, q);
    const totalPages = Math.ceil(total / limit);

    // Render conversations list
    res.render('conversations', {
      conversations: items,
      total,
      page,
      totalPages,
      limit,
      query: q,
    });
  } catch (err: any) {
    console.error('Admin GET / error:', err?.message || err);
    res.status(500).render('error', { error: err?.message || 'Unknown error' });
  }
});

// (ping route is defined above, before auth)

adminRouter.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const convo = await getConversation(id);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    
    const messages = await getMessagesForConversation(id);
    
    // Render conversation detail view
    res.render('conversation', { convo, messages });
  } catch (err: any) {
    console.error('Admin GET /conversations/:id error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
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
