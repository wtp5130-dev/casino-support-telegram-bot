import express from 'express';
import { ensureConfig } from './config.js';
import { adminRouter } from './admin/routes.js';
import { upsertConversation, setConversationRGFlag } from './models/conversations.js';
import { findInboundByTelegramId, insertMessage } from './models/messages.js';
import { sendMessage, TelegramUpdate } from './telegram.js';
import { moderateText, refusalMessage, shouldAddRGFooter } from './utils/moderation.js';
import { retrieveTopK } from './rag/retrieve.js';
import { generateReply } from './openai.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ejsLayouts } from './admin/views/_ejsLayoutShim.js';
import { initSchema } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json({ limit: '2mb' }));

// Add timeout to all responses to prevent infinite hangs
app.use((req, res, next) => {
  res.setTimeout(10000, () => {
    console.error('Response timeout for', req.path);
    res.status(504).json({ error: 'Response timeout' });
  });
  next();
});

// Views - resolve robustly for both local and serverless builds
const candidateViews = [
  path.resolve(process.cwd(), 'src/admin/views'),
  path.resolve(process.cwd(), 'dist/src/admin/views'),
  path.join(__dirname, 'admin/views'),
];
let resolvedViews = candidateViews.find((p) => fs.existsSync(path.join(p, 'layout.ejs')));
if (!resolvedViews) resolvedViews = candidateViews[0];
app.set('views', resolvedViews);
app.set('view engine', 'ejs');
(ejsLayouts as any)(app);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/health/env', (_req, res) => {
  const envStatus = {
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    ADMIN_USER: !!process.env.ADMIN_USER,
    ADMIN_PASS: !!process.env.ADMIN_PASS,
    BASE_URL: process.env.BASE_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV,
  };
  res.json(envStatus);
});

app.get('/', (_req, res) => res.json({ ok: true, service: 'Casino Support Telegram Bot' }));

app.post('/telegram/webhook', async (req, res) => {
  const update = req.body as TelegramUpdate;
  try {
    if (!update.message || !update.message.text) {
      return res.json({ ok: true });
    }
    const chatId = String(update.message.chat.id);
    const username = update.message.chat.username || update.message.from?.username || null;
    const convo = await upsertConversation('telegram', chatId, username);

    // Idempotency for inbound messages
    const existingInbound = await findInboundByTelegramId(convo.id, String(update.message.message_id));
    if (!existingInbound) {
      await insertMessage({
        conversation_id: convo.id,
        direction: 'in',
        role: 'user',
        text: update.message.text,
        telegram_message_id: String(update.message.message_id),
      });
    }

    // Commands
    const text = update.message.text.trim();
    if (text === '/start') {
      const welcome = [
        'Hi! I\'m your Casino Support Assistant. I can help with account access, KYC, deposits/withdrawals, bonus terms, technical issues, responsible gaming tools, and contacting support.',
        'Please avoid asking for betting strategies or exploits — I\'ll have to refuse.',
      ].join('\n');
      const outId = await sendMessage(update.message.chat.id, welcome);
      await insertMessage({ conversation_id: convo.id, direction: 'out', role: 'assistant', text: welcome, telegram_message_id: String(outId || '') });
      return res.json({ ok: true });
    }
    if (text === '/help') {
      const help = 'You can ask about account issues, KYC steps, deposits/withdrawals, bonus terms in our policy, troubleshooting, and responsible gaming options (limits/self-exclusion).';
      const outId = await sendMessage(update.message.chat.id, help);
      await insertMessage({ conversation_id: convo.id, direction: 'out', role: 'assistant', text: help, telegram_message_id: String(outId || '') });
      return res.json({ ok: true });
    }

    // Moderation
    const mod = moderateText(update.message.text);
    if (mod.disallowed) {
      const reply = refusalMessage();
      const outId = await sendMessage(update.message.chat.id, reply);
      await insertMessage({ conversation_id: convo.id, direction: 'out', role: 'assistant', text: reply, telegram_message_id: String(outId || '') });
      if (mod.rgRisk) await setConversationRGFlag(convo.id, true);
      return res.json({ ok: true });
    }

    if (mod.rgRisk) await setConversationRGFlag(convo.id, true);

    const retrieved = await retrieveTopK(text, 5);

    const rgNote = mod.rgRisk ? 'User may be at risk; be supportive, mention limits/self-exclusion and professional help resources.' : undefined;

    const gen = await generateReply({ userText: text, retrieved, rgNote });

    let answer = gen.text;
    if (shouldAddRGFooter(text, mod.rgRisk)) {
      answer += '\n\nIf you feel gambling is becoming a problem, we can help you set limits or self-exclude.';
    }

    const outMsgId = await sendMessage(update.message.chat.id, answer);

    await insertMessage({
      conversation_id: convo.id,
      direction: 'out',
      role: 'assistant',
      text: answer,
      telegram_message_id: String(outMsgId || ''),
      model: gen.model || null,
      prompt_tokens: gen.prompt_tokens ?? null,
      completion_tokens: gen.completion_tokens ?? null,
    });

    res.json({ ok: true });
  } catch (err) {
    const friendly = 'Sorry, something went wrong. Please try again later or contact support.';
    try {
      if (req.body?.message?.chat?.id) {
        await sendMessage(req.body.message.chat.id, friendly);
      }
    } catch {}
    res.json({ ok: true });
  }
});

app.use('/admin', adminRouter);

export async function init() {
  try {
    // Validate env only when initializing the app (serverless-safe)
    ensureConfig();
    await initSchema();
  } catch (err: any) {
    console.error('App init error:', err?.message || err);
    throw err;
  }
}

export default app;
