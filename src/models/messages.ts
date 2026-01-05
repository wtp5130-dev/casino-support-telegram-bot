import { db, nowIso } from '../db.js';

export type Message = {
  id: number;
  conversation_id: number;
  direction: 'in' | 'out';
  role: 'user' | 'assistant' | 'system';
  text: string;
  created_at: string;
  telegram_message_id?: string | null;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
};

export function insertMessage(params: Omit<Message, 'id' | 'created_at'> & { created_at?: string }) {
  const created_at = params.created_at ?? nowIso();
  const info = db.prepare(`INSERT INTO messages (conversation_id, direction, role, text, created_at, telegram_message_id, model, prompt_tokens, completion_tokens)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    params.conversation_id,
    params.direction,
    params.role,
    params.text,
    created_at,
    params.telegram_message_id ?? null,
    params.model ?? null,
    params.prompt_tokens ?? null,
    params.completion_tokens ?? null
  );
  return info.lastInsertRowid as number;
}

export function getMessagesForConversation(conversation_id: number) {
  return db.prepare(`SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC, id ASC`).all(conversation_id) as Message[];
}

export function findInboundByTelegramId(conversation_id: number, telegram_message_id: string) {
  return db.prepare(`SELECT * FROM messages WHERE conversation_id=? AND direction='in' AND telegram_message_id=?`).get(conversation_id, telegram_message_id) as Message | undefined;
}
