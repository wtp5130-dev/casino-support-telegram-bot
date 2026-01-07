import OpenAI from 'openai';
import { config } from './config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export type RetrievedChunk = { source: string; chunk_index: number; text: string; score: number };

const SYSTEM_POLICY = `You are \"Casino Support Assistant\" for customer support only.
Allowed topics: account help, KYC, deposits/withdrawals status and steps, bonus terms as written in KB, technical troubleshooting, contacting human support, responsible gaming tools (limits, self-exclusion).
Disallowed topics (REFUSE): betting strategy, \"how to win\", game manipulation, exploiting bonuses, bypassing KYC, fraud, chargebacks, laundering, evading limits.
If user requests disallowed content: politely refuse, offer legitimate support alternatives, and mention responsible gaming tools.
If user expresses distress/problem gambling: respond supportively, explain available responsible gaming tools (from KB if present), encourage seeking help from local professional resources, and offer to connect to human support.
Never ask for passwords, full card numbers, CVV, or full bank details. When asking for identifiers, request only minimal info: username, approximate timestamp, transaction reference, last 4 digits, masked email. Encourage official in-app channels for sensitive actions.`;

export async function generateReply(params: {
  userText: string;
  retrieved: RetrievedChunk[];
  rgNote?: string;
}) {
  const { userText, retrieved, rgNote } = params;
  const refs = retrieved.map((r) => `- ${r.text}`).join('\n');
  const referenceContext = refs ? `Reference context (from KB):\n${refs}` : 'No KB context matched.';

  const system = SYSTEM_POLICY + (rgNote ? `\nResponsible gaming note: ${rgNote}` : '');

  // Using Chat Completions for reliability with instructions in system.
  const completion = await openai.chat.completions.create({
    model: config.OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          `User request: ${userText}`,
          '',
          referenceContext,
          '',
          'Instructions:',
          '- Use KB as source of truth for policy/terms.',
          '- If unsure or missing info in KB, ask for clarifications or provide general guidance without making policy claims.',
          '- Do not include citations or source tags in the reply.',
          '- Keep responses concise, professional, and supportive.',
        ].join('\n'),
      },
    ],
  });

  let text = completion.choices[0]?.message?.content ?? '';
  // Do not append sources to the user-visible reply.
  const usage = completion.usage;
  const model = completion.model;
  return {
    text,
    model,
    prompt_tokens: usage?.prompt_tokens ?? null,
    completion_tokens: usage?.completion_tokens ?? null,
  };
}
