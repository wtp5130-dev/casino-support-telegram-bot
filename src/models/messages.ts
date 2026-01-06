import { sql, nowIso } from '../db.js';

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

export async function insertMessage(params: Omit<Message, 'id' | 'created_at'> & { created_at?: string }) {
  const created_at = params.created_at ?? nowIso();
  const res = await sql<{ id: number }>`
    INSERT INTO messages (conversation_id, direction, role, text, created_at, telegram_message_id, model, prompt_tokens, completion_tokens)
    VALUES (${params.conversation_id}, ${params.direction}, ${params.role}, ${params.text}, ${created_at}, ${params.telegram_message_id ?? null}, ${params.model ?? null}, ${params.prompt_tokens ?? null}, ${params.completion_tokens ?? null})
    RETURNING id
  `;
  return (res[0] as any).id;
}

export async function getMessagesForConversation(conversation_id: number) {
  const res = await sql<Message>`SELECT * FROM messages WHERE conversation_id=${conversation_id} ORDER BY created_at ASC, id ASC`;
  return (res || []) as any;
}

export async function findInboundByTelegramId(conversation_id: number, telegram_message_id: string) {
  const res = await sql<Message>`SELECT * FROM messages WHERE conversation_id=${conversation_id} AND direction='in' AND telegram_message_id=${telegram_message_id} LIMIT 1`;
  return (res[0] || undefined) as any;
}
