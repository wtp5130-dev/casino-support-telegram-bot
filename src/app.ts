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

app.get('/admin', (_req, res) => {
  res.json({ ok: true, message: 'Admin dashboard', note: 'Full UI coming soon' });
});

export async function handleWebhook(update: TelegramUpdate): Promise<void> {
  console.log('[handleWebhook] Processing update');
  try {
    if (!update.message || !update.message.text) {
      console.log('[handleWebhook] No message text, returning');
      return;
    }
    const chatId = String(update.message.chat.id);
    const username = update.message.chat.username || update.message.from?.username || null;
    console.log('[handleWebhook] Upserting conversation', { chatId, username });
    const convo = await upsertConversation('telegram', chatId, username);
    console.log('[handleWebhook] Conversation upserted', { convoId: convo.id });

    // Idempotency for inbound messages
    const existingInbound = await findInboundByTelegramId(convo.id, String(update.message.message_id));
    if (!existingInbound) {
      console.log('[handleWebhook] Inserting inbound message');
      await insertMessage({
        conversation_id: convo.id,
        direction: 'in',
        role: 'user',
        text: update.message.text,
        telegram_message_id: String(update.message.message_id),
      });
    } else {
      console.log('[handleWebhook] Message already exists (idempotency)');
    }

    // Commands
    const text = update.message.text.trim();
    if (text === '/start') {
      console.log('[handleWebhook] Processing /start command');
      const welcome = [
        'Hi! I\'m your Casino Support Assistant. I can help with account access, KYC, deposits/withdrawals, bonus terms, technical issues, responsible gaming tools, and contacting support.',
        'Please avoid asking for betting strategies or exploits — I\'ll have to refuse.',
      ].join('\n');
      const outId = await sendMessage(update.message.chat.id, welcome);
      console.log('[handleWebhook] Welcome message sent', { outId });
      await insertMessage({ conversation_id: convo.id, direction: 'out', role: 'assistant', text: welcome, telegram_message_id: String(outId || '') });
      return;
    }
    if (text === '/help') {
      console.log('[handleWebhook] Processing /help command');
      const help = 'You can ask about account issues, KYC steps, deposits/withdrawals, bonus terms in our policy, troubleshooting, and responsible gaming options (limits/self-exclusion).';
      const outId = await sendMessage(update.message.chat.id, help);
      console.log('[handleWebhook] Help message sent', { outId });
      await insertMessage({ conversation_id: convo.id, direction: 'out', role: 'assistant', text: help, telegram_message_id: String(outId || '') });
      return;
    }

    // Moderation
    console.log('[handleWebhook] Running moderation check');
    const mod = moderateText(update.message.text);
    if (mod.disallowed) {
      console.log('[handleWebhook] Message blocked by moderation', { disallowedTerms: mod.disallowedTerms });
      const reply = refusalMessage();
      const outId = await sendMessage(update.message.chat.id, reply);
      console.log('[handleWebhook] Refusal sent', { outId });
      await insertMessage({ conversation_id: convo.id, direction: 'out', role: 'assistant', text: reply, telegram_message_id: String(outId || '') });
      if (mod.rgRisk) await setConversationRGFlag(convo.id, true);
      return;
    }

    if (mod.rgRisk) {
      console.log('[handleWebhook] RG risk detected, setting flag');
      await setConversationRGFlag(convo.id, true);
    }

    console.log('[handleWebhook] Retrieving KB chunks for RAG');
    const retrieved = await retrieveTopK(text, 5);
    console.log('[handleWebhook] Retrieved', { count: retrieved.length });

    const rgNote = mod.rgRisk ? 'User may be at risk; be supportive, mention limits/self-exclusion and professional help resources.' : undefined;

    console.log('[handleWebhook] Generating OpenAI response');
    const gen = await generateReply({ userText: text, retrieved, rgNote });
    console.log('[handleWebhook] Response generated', { model: gen.model, tokens: { prompt: gen.prompt_tokens, completion: gen.completion_tokens } });

    let answer = gen.text;
    if (shouldAddRGFooter(text, mod.rgRisk)) {
      answer += '\n\nIf you feel gambling is becoming a problem, we can help you set limits or self-exclude.';
    }

    console.log('[handleWebhook] Sending response to Telegram');
    const outMsgId = await sendMessage(update.message.chat.id, answer);
    console.log('[handleWebhook] Response sent', { outMsgId });

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
    console.log('[handleWebhook] Message logged to database');
  } catch (err) {
    console.error('[handleWebhook] Error:', (err as any)?.message || err, { stack: (err as any)?.stack?.substring(0, 200) });
    const friendly = 'Sorry, something went wrong. Please try again later or contact support.';
    try {
      if (update.message?.chat?.id) {
        console.log('[handleWebhook] Sending error response');
        await sendMessage(update.message.chat.id, friendly);
      }
    } catch (e) {
      console.error('[handleWebhook] Failed to send error response:', e);
    }
  }
}

app.post('/telegram/webhook', async (req, res) => {
  const update = req.body as TelegramUpdate;
  try {
    await handleWebhook(update);
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook route error:', err);
    res.json({ ok: true });
  }
});

// Temporarily disable admin router to isolate hanging issue
// app.use('/admin', adminRouter);

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
