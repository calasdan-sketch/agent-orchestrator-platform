import Anthropic from '@anthropic-ai/sdk';
import type { AppConfig } from '../config/index.js';
import { ConfigError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import type { LlmClient } from './llm-client.js';
import { OpenRouterClient } from './openrouter.js';

const log = createLogger('llm');

/** Build the configured LlmClient (Anthropic direct, or OpenRouter). */
export function createLlmClient(config: AppConfig['llm']): LlmClient {
  if (config.provider === 'openrouter') {
    if (!config.openrouterApiKey) {
      throw new ConfigError('OPENROUTER_API_KEY is not configured');
    }
    return new OpenRouterClient(config.openrouterApiKey);
  }
  if (!config.apiKey) {
    throw new ConfigError('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey: config.apiKey }) as unknown as LlmClient;
}

/** Model id/slug for the currently configured provider. */
export function modelFor(config: AppConfig['llm']): string {
  return config.provider === 'openrouter'
    ? config.openrouterModel
    : config.model;
}

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Run a single system+user completion. The system prompt is marked as an
 * ephemeral cache breakpoint, so agents that reuse the same role instructions
 * across many jobs (the common case) reuse cached input tokens instead of
 * being re-billed for them on every call.
 */
export async function complete(
  client: LlmClient,
  config: AppConfig['llm'],
  system: string,
  userPrompt: string,
): Promise<CompletionResult> {
  const response = await client.messages.create({
    model: modelFor(config),
    max_tokens: config.maxTokens,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  log.debug(
    {
      cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage?.cache_creation_input_tokens ?? 0,
    },
    'LLM prompt cache usage',
  );

  return {
    text: extractText(response.content),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
    .trim();
}

/**
 * Parse a JSON object from a model response, tolerating surrounding prose or
 * markdown code fences.
 */
export function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
