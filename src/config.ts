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

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config: AppConfig = {
  PORT: Number(process.env.PORT || 3000),
  BASE_URL: requireEnv('BASE_URL'),
  TELEGRAM_BOT_TOKEN: requireEnv('TELEGRAM_BOT_TOKEN'),
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),
  ADMIN_USER: requireEnv('ADMIN_USER', 'admin'),
  ADMIN_PASS: requireEnv('ADMIN_PASS', 'change_me'),
  OPENAI_MODEL: requireEnv('OPENAI_MODEL', 'gpt-4.1-mini'),
  OPENAI_EMBEDDING_MODEL: requireEnv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-large'),
  POSTGRES_URL: requireEnv('POSTGRES_URL'),
};
