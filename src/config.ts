import 'dotenv/config';

export type AppConfig = {
  PORT: number;
  BASE_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  OPENAI_API_KEY: string;
  ADMIN_USER: string;
  ADMIN_PASS: string;
  OPENAI_MODEL: string;
  OPENAI_EMBEDDING_MODEL: string;
  POSTGRES_URL: string;
};

export const config: AppConfig = {
  PORT: Number(process.env.PORT || 3000),
  BASE_URL: process.env.BASE_URL || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASS: process.env.ADMIN_PASS || 'change_me',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
  POSTGRES_URL: process.env.POSTGRES_URL || '',
};

export function ensureConfig() {
  const required = [
    'BASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'OPENAI_API_KEY',
    'POSTGRES_URL',
    'ADMIN_USER',
    'ADMIN_PASS',
  ] as const;
  for (const key of required) {
    const v = (config as any)[key];
    if (!v || String(v).trim() === '') {
      throw new Error(`Missing env var: ${key}`);
    }
  }
}
