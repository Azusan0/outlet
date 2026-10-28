export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxIterations: number;
  maxTokens: number;
  temperature: number;
};

function boundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function getAiConfig(): AiConfig {
  return {
    baseUrl: process.env.AI_BASE_URL?.trim() || "https://api.deepseek.com",
    // Support common aliases without exposing which one is configured.
    apiKey:
      process.env.AI_API_KEY?.trim() ||
      process.env.DEEPSEEK_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      "",
    model: process.env.AI_MODEL?.trim() || "deepseek-chat",
    timeoutMs: boundedInteger(
      process.env.AI_TIMEOUT_MS,
      30_000,
      3_000,
      120_000,
    ),
    maxIterations: boundedInteger(process.env.AI_MAX_ITERATIONS, 4, 1, 8),
    maxTokens: boundedInteger(process.env.AI_MAX_TOKENS, 1_400, 128, 8_192),
    temperature: Math.min(
      1,
      Math.max(
        0,
        Number.parseFloat(process.env.AI_TEMPERATURE ?? "0.2") || 0.2,
      ),
    ),
  };
}
