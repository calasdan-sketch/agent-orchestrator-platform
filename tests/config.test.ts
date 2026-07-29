import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, resetConfigCache } from '../src/config/index.js';

describe('config', () => {
  beforeEach(() => {
    resetConfigCache();
  });

  it('applies defaults when env vars are absent', () => {
    delete process.env.PORT;
    const config = loadConfig();
    expect(config.port).toBe(3100);
    expect(config.llm.model).toContain('claude');
  });

  it('coerces numeric port from env', () => {
    process.env.PORT = '8080';
    resetConfigCache();
    expect(loadConfig().port).toBe(8080);
  });

  it('defaults the LLM provider to anthropic', () => {
    delete process.env.CLAUDE_PROVIDER;
    resetConfigCache();
    expect(loadConfig().llm.provider).toBe('anthropic');
  });

  it('accepts openrouter as an alternate provider', () => {
    process.env.CLAUDE_PROVIDER = 'openrouter';
    resetConfigCache();
    expect(loadConfig().llm.provider).toBe('openrouter');
  });

  it('rejects an unknown provider', () => {
    process.env.CLAUDE_PROVIDER = 'not-a-real-provider';
    resetConfigCache();
    expect(() => loadConfig()).toThrow();
  });
});
