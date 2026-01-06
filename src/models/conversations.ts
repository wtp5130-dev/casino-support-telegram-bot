import { sql, nowIso } from '../db.js';

export type Conversation = {
  id: number;
  platform: string;
  chat_id: string;
  username: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  rg_flag: number;
};

export async function upsertConversation(platform: string, chat_id: string, username?: string | null): Promise<Conversation> {
  const now = nowIso();
  const result = await sql<Conversation>`
    INSERT INTO conversations (platform, chat_id, username, first_seen_at, last_seen_at)
    VALUES (${platform}, ${chat_id}, ${username ?? null}, ${now}, ${now})
    ON CONFLICT (platform, chat_id)
    DO UPDATE SET last_seen_at = ${now}, username = COALESCE(${username ?? null}, conversations.username)
    RETURNING *;
  `;
  return result.rows[0] as any;
}

export async function setConversationRGFlag(id: number, flag: boolean) {
  await sql`UPDATE conversations SET rg_flag=${flag ? 1 : 0} WHERE id=${id}`;
}

export async function listConversations(limit = 50, offset = 0, q?: string) {
  const like = q && q.trim() ? `%${q}%` : null;
  if (like) {
    const itemsRes = await sql< (Conversation & { last_text?: string; last_message_at?: string }) >`
      SELECT c.*, 
        (SELECT text FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_text,
        (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_at
      FROM conversations c
      WHERE chat_id ILIKE ${like} OR username ILIKE ${like} OR id IN (SELECT conversation_id FROM messages WHERE text ILIKE ${like})
      ORDER BY c.last_seen_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRes = await sql<{ c: number }>`
      SELECT COUNT(*)::int as c FROM conversations c
      WHERE chat_id ILIKE ${like} OR username ILIKE ${like} OR id IN (SELECT conversation_id FROM messages WHERE text ILIKE ${like})
    `;
    const items = itemsRes.rows as any;
    const total = totalRes.rows[0]?.c || 0;
    return { items, total };
  } else {
    const itemsRes = await sql< (Conversation & { last_text?: string; last_message_at?: string }) >`
      SELECT c.*, 
        (SELECT text FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_text,
        (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_at
      FROM conversations c
      ORDER BY c.last_seen_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRes = await sql<{ c: number }>`SELECT COUNT(*)::int as c FROM conversations`;
    return { items: itemsRes.rows as any, total: totalRes.rows[0].c };
  }
}

export async function getConversation(id: number) {
  const res = await sql<Conversation>`SELECT * FROM conversations WHERE id=${id} LIMIT 1`;
  return (res.rows[0] || undefined) as any;
}
