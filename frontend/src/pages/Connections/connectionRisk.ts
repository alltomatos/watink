/**
 * Classificação de risco de ban/throttle a partir do último sinal
 * `session.risk` persistido na conexão (whatsmeow IQ 401/403/429/463).
 *
 * Estado sempre DERIVADO (nunca persistido) — recalculado a partir de
 * `lastRiskCode`/`lastRiskAt`, no mesmo espírito do Checklist de Onboarding.
 */

export type ConnectionHealthLevel = "ok" | "warning" | "critical";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/** Códigos que por si só já indicam throttle de IP/volume (mesmos que o
 * business auto-isola o proxy). */
const CRITICAL_CODES = new Set([429, 463]);

export interface ConnectionRiskInfo {
  code?: number;
  at?: string | null;
}

export function getConnectionHealthLevel(risk: ConnectionRiskInfo): ConnectionHealthLevel {
  if (!risk.code || !risk.at) return "ok";

  const riskAt = new Date(risk.at).getTime();
  if (Number.isNaN(riskAt)) return "ok";

  const ageMs = Date.now() - riskAt;
  if (ageMs < 0 || ageMs > ONE_DAY_MS) return "ok";

  if (CRITICAL_CODES.has(risk.code) && ageMs < ONE_HOUR_MS) return "critical";
  return "warning";
}

/** Explicação em português de cada código de risco, para exibir ao usuário
 * exatamente o que está acontecendo — não só o número do erro. */
export const RISK_CODE_EXPLANATIONS: Record<number, string> = {
  401: "O WhatsApp recusou uma ação por falta de autorização — pode indicar que a sessão está sendo vista como suspeita.",
  403: "O WhatsApp bloqueou uma ação nesta conexão (forbidden) — sinal de restrição da conta.",
  429: "O WhatsApp está limitando o volume de ações desta conexão (rate-overlimit) — reduza o ritmo de envios.",
  463: "O WhatsApp está limitando o alcance desta conexão (reach-out timelock) — isso pode preceder um banimento. Evite iniciar conversas com números novos por enquanto.",
};

export function describeRiskCode(code?: number): string {
  if (!code) return "";
  return RISK_CODE_EXPLANATIONS[code] ?? `O WhatsApp retornou um sinal de risco (código ${code}) para esta conexão.`;
}

/** Referência educativa dos limiares de segurança citados na pesquisa
 * anti-ban — conteúdo estático, não calculado a partir de dados reais. */
export const ANTI_BAN_THRESHOLDS: { label: string; safe: string; danger: string }[] = [
  { label: "Taxa de resposta às mensagens enviadas", safe: "> 30%", danger: "< 15%" },
  { label: "Taxa de bloqueio pelos destinatários", safe: "< 2%", danger: "> 2%" },
  { label: "Novos contatos por dia (primeira mensagem)", safe: "< 20/dia", danger: "> 50/dia" },
  { label: "Uso proativo (inicia conversa) vs. reativo (só responde)", safe: "reativo: < 2% de ban em 12 meses", danger: "proativo: 15–30% de ban em 12 meses" },
];
