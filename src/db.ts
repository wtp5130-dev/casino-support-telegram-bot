import { neon, neonConfig } from '@neondatabase/serverless';

// Cache HTTP connections across invocations in serverless
neonConfig.fetchConnectionCache = true;

// Create a tagged template query function from Neon
export const sql = neon(process.env.POSTGRES_URL || '');

export async function checkDatabaseHealth() {
  try {
    const result = await Promise.race([
      sql`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), 3000)
      ),
    ]);
    return true;
  } catch (err: any) {
    console.error('Database health check failed:', err?.message || err);
    return false;
  }
}

export async function initSchema() {
  try {
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
  } catch (err: any) {
    // Log but don't throw if tables already exist
    if (!err?.message?.includes('already exists')) {
      console.error('Schema init error:', err?.message || err);
    }
  }
}

export function nowIso() {
  return new Date().toISOString();
}
