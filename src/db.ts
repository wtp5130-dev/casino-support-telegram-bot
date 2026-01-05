import { sql } from '@vercel/postgres';

export { sql };

export async function initSchema() {
  // conversations
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'telegram',
      chat_id TEXT NOT NULL,
      username TEXT,
      first_seen_at TEXT,
      last_seen_at TEXT,
      rg_flag INTEGER NOT NULL DEFAULT 0,
      UNIQUE(platform, chat_id)
    );
  `;
  // messages
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      direction TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      telegram_message_id TEXT,
      model TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER
    );
  `;
  // kb_chunks
  await sql`
    CREATE TABLE IF NOT EXISTS kb_chunks (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(source, chunk_index)
    );
  `;
}

export function nowIso() {
  return new Date().toISOString();
}
