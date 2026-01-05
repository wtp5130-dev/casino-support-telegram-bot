# Casino Support Telegram Bot (Node.js + TypeScript)

A Telegram customer support assistant for an online casino, powered by OpenAI with RAG over a local knowledge base, plus an admin web UI to review conversations.

Key features:
- Telegram webhook bot with OpenAI responses + KB retrieval
- RAG over /kb (txt, md, pdf)
- SQLite persistence (conversations, messages, KB chunks)
- Admin UI (Basic Auth) to list, search, and view conversations
- Responsible Gaming moderation and safety behaviors

## Safety and Compliance
The assistant is a customer support bot, not a gambling coach.
- Allowed topics: account access, KYC/verification steps, deposits/withdrawals, bonus/promotions terms (per KB), technical issues, responsible gaming tools, and contacting support.
- Disallowed: betting strategies, guaranteed wins, exploiting bonuses, bypassing KYC, fraud, chargeback abuse, laundering, evading limits.
- If a user asks for disallowed content, the bot refuses politely and offers legitimate support alternatives, and reminds of responsible gaming tools.
- If a user indicates problem gambling or asks to self-exclude, the bot responds supportively, explains limits/self-exclusion (from KB if present) and suggests professional resources.
- Never request or store full passwords, full card numbers, CVV, or full bank account numbers. Request only minimal identifiers when needed (username, approximate timestamp, transaction reference, last 4 digits, masked email/phone).

## Prerequisites
- Node.js 20+
- A Telegram bot token from BotFather
- An OpenAI API key

## Environment
Copy .env.example to .env and fill in values:

PORT=3000
BASE_URL=https://your-public-url.example
TELEGRAM_BOT_TOKEN=123:ABC
OPENAI_API_KEY=sk-...
ADMIN_USER=admin
ADMIN_PASS=change_me
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
DATABASE_PATH=./data/data.db

## Install

npm install

## Run locally

- Dev server:

npm run dev

- Build and start:

npm run build
npm start

Server will start on http://localhost:3000 by default.

## Telegram Webhook Setup
1) Use a public URL via ngrok:
- Install and run: ngrok http 3000
- Note the https forwarding URL, e.g. https://abcd1234.ngrok.io

2) Set BASE_URL in .env to that URL.

3) Set the webhook:
- Replace TOKEN and BASE_URL
- GET: https://api.telegram.org/botTOKEN/setWebhook?url=BASE_URL/telegram/webhook

To delete webhook:
- GET: https://api.telegram.org/botTOKEN/deleteWebhook

Test by sending /start to your bot.

## Knowledge Base Ingestion
Place txt, md, or pdf files in /kb. Then run:

npm run ingest

This will:
- Extract text (including PDF via pdf-parse)
- Chunk into 800-char chunks with 100-char overlap
- Create embeddings with OpenAI
- Store in SQLite table kb_chunks

## Admin UI
- Open http://localhost:3000/admin
- Basic Auth required (ADMIN_USER / ADMIN_PASS)
- Pages:
  - Conversations list with search and RG flag indicator
  - Conversation detail with full thread
- API routes (used by UI):
  - GET /admin/api/conversations?limit=&offset=&q=
  - GET /admin/api/conversations/:id/messages

## Responsible Gaming Flags
If a user message contains phrases like “addicted”, “can’t stop”, “lost everything”, “self exclude”, “problem”, “gambling too much”, the conversation is flagged (rg_flag=1). Listings show a badge.

## Testing

npm test

Tests cover chunking, similarity, and moderation.

## Reliability and Notes
- Startup validates required environment variables
- Secrets are never logged
- Telegram retries handled idempotently where possible
- Basic per-chat rate limiting
- Graceful error handling with friendly Telegram replies

## Deploying (Vercel + GitHub)
- Push this repo to GitHub
- In Vercel, create a new project from the repo
- Set environment variables in Vercel dashboard (.env values)
- Set build command: npm run build
- Set output/start: npm start (use Node server on Vercel’s Node serverless/Edge is not suitable for persistent SQLite). Alternatively deploy to a Node host (Railway/Fly.io/Render) for long-running server.
- Configure Telegram webhook with your public URL

## What to put in /kb
- KYC steps, accepted documents
- Deposit/withdrawal methods and timelines
- Bonus terms and wagering requirements
- Responsible gaming policy: limits, timeouts, self-exclusion
- Support contact channels and SLAs
