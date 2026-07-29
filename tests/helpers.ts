import type { AppConfig } from '../src/config/index.js';

/**
 * Build a fully-populated AppConfig for tests, with overrides.
 */
export function makeTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 3100,
    logLevel: 'silent',
    databasePath: ':memory:',
    llm: {
      apiKey: 'anthropic-key',
      model: 'claude-x',
      maxTokens: 100,
      provider: 'anthropic',
      openrouterApiKey: '',
      openrouterModel: 'anthropic/claude-3.5-sonnet',
    },
    ...overrides,
  };
}
