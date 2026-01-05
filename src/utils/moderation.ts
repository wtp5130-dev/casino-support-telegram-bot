export type ModerationResult = {
  disallowed: boolean;
  disallowedTerms: string[];
  rgRisk: boolean;
  rgTerms: string[];
};

const DISALLOWED_KEYWORDS = [
  'betting strategy', 'how to win', 'guaranteed win', 'sure bet', 'fix the game', 'exploit', 'system exploit', 'bonus abuse', 'bypass kyc', 'fake id', 'evade limits', 'money laundering', 'chargeback', 'refund hack', 'carding', 'multi account', 'script to win', 'cheat', 'rig the game', 'insider odds'
];

const RG_KEYWORDS = [
  'addicted', "can't stop", 'cant stop', 'lost everything', 'self exclude', 'self-exclude', 'problem', 'gambling too much', 'compulsive', 'problem gambling', 'help me stop'
];

export function moderateText(text: string): ModerationResult {
  const t = text.toLowerCase();
  const disallowedTerms = DISALLOWED_KEYWORDS.filter((k) => t.includes(k));
  const rgTerms = RG_KEYWORDS.filter((k) => t.includes(k));
  return {
    disallowed: disallowedTerms.length > 0,
    disallowedTerms,
    rgRisk: rgTerms.length > 0,
    rgTerms,
  };
}

export function refusalMessage(): string {
  return [
    "Sorry, I can't assist with strategies, exploits, or anything that increases gambling intensity.",
    'I can help with account access, KYC, deposits/withdrawals, bonus terms (per policy), troubleshooting, responsible gaming tools, or connecting you with human support.',
    'If you feel gambling is becoming a problem, we can help you set limits or self-exclude.'
  ].join(' ');
}

export function shouldAddRGFooter(text: string, rgRisk: boolean) {
  const sensitiveHints = ['loss', 'lost', 'debt', 'addict', 'stop gambling', 'self exclude'];
  const t = text.toLowerCase();
  if (rgRisk) return true;
  return sensitiveHints.some((k) => t.includes(k));
}
