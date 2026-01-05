import { db, nowIso } from '../db.js';

export type Conversation = {
  id: number;
  platform: string;
  chat_id: string;
  username: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  rg_flag: number;
};

export function upsertConversation(platform: string, chat_id: string, username?: string | null): Conversation {
  const existing = db.prepare(`SELECT * FROM conversations WHERE platform=? AND chat_id=?`).get(platform, chat_id) as Conversation | undefined;
  if (existing) {
    db.prepare(`UPDATE conversations SET last_seen_at=?, username=COALESCE(?, username) WHERE id=?`).run(nowIso(), username ?? null, existing.id);
    return { ...existing, last_seen_at: nowIso(), username: username ?? existing.username };
  }
  const now = nowIso();
  const info = db.prepare(`INSERT INTO conversations(platform, chat_id, username, first_seen_at, last_seen_at) VALUES(?,?,?,?,?)`).run(platform, chat_id, username ?? null, now, now);
  return db.prepare(`SELECT * FROM conversations WHERE id=?`).get(info.lastInsertRowid) as Conversation;
}

export function setConversationRGFlag(id: number, flag: boolean) {
  db.prepare(`UPDATE conversations SET rg_flag=? WHERE id=?`).run(flag ? 1 : 0, id);
}

export function listConversations(limit = 50, offset = 0, q?: string) {
  const params: any[] = [];
  let where = '';
  if (q && q.trim()) {
    where = `WHERE chat_id LIKE ? OR username LIKE ? OR id IN (SELECT conversation_id FROM messages WHERE text LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const items = db.prepare(`
    SELECT c.*, (
      SELECT text FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1
    ) AS last_text, (
      SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1
    ) AS last_message_at
    FROM conversations c
    ${where}
    ORDER BY c.last_seen_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (Conversation & { last_text?: string; last_message_at?: string })[];
  const total = db.prepare(`SELECT COUNT(*) as c FROM conversations ${where}`).get(...params) as { c: number };
  return { items, total: total.c };
}

export function getConversation(id: number) {
  return db.prepare(`SELECT * FROM conversations WHERE id=?`).get(id) as Conversation | undefined;
}
