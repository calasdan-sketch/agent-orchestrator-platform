import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralised, validated application configuration.
 *
 * All secrets and environment-specific values are read from environment
 * variables (see `.env.example`). Nothing here should ever be committed with a
 * real value.
 */
const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().positive().default(3100),
  logLevel: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  databasePath: z.string().default('./data/agents.sqlite'),

  llm: z.object({
    apiKey: z.string().default(''),
    model: z.string().default('claude-3-5-sonnet-20241022'),
    maxTokens: z.coerce.number().int().positive().default(1024),
    provider: z.enum(['anthropic', 'openrouter']).default('anthropic'),
    openrouterApiKey: z.string().default(''),
    openrouterModel: z.string().default('anthropic/claude-3.5-sonnet'),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

let cachedConfig: AppConfig | null = null;

/**
 * Load and validate configuration from the environment.
 *
 * The result is cached so repeated calls are cheap and consistent.
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = configSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    databasePath: process.env.DATABASE_PATH,
    llm: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL,
      maxTokens: process.env.CLAUDE_MAX_TOKENS,
      provider: process.env.CLAUDE_PROVIDER,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
      openrouterModel: process.env.OPENROUTER_MODEL,
    },
  });

  cachedConfig = parsed;
  return parsed;
}

/**
 * Reset the cached config. Intended for tests only.
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
