export function safeLog(message: string, meta?: Record<string, any>) {
  const sanitized: Record<string, any> = {};
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (typeof v === 'string' && /key|token|pass|secret/i.test(k)) {
        sanitized[k] = v.slice(0, 4) + '***';
      } else {
        sanitized[k] = v;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(message, Object.keys(sanitized).length ? sanitized : '');
}
