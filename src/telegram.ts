import fetch from 'node-fetch';
import { config } from './config.js';

const BASE = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: { id: number; username?: string };
    from?: { id: number; username?: string };
  };
};

export async function sendMessage(chat_id: number | string, text: string) {
  const resp = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' }),
  });
  if (!resp.ok) throw new Error(`Telegram sendMessage failed: ${resp.status}`);
  const data = await resp.json() as any;
  return data.result?.message_id as number | undefined;
}
