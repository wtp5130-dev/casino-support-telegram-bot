type Entry = { count: number; resetAt: number };

const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 5;

const perChat: Map<string, Entry> = new Map();

export function checkRateLimit(chatId: string): boolean {
  const now = Date.now();
  const e = perChat.get(chatId);
  if (!e || now > e.resetAt) {
    perChat.set(chatId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (e.count < MAX_PER_WINDOW) {
    e.count += 1;
    return true;
  }
  return false;
}
