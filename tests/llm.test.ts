import { describe, expect, it, vi } from 'vitest';
import { complete, parseJsonLoose } from '../src/services/llm.js';
import type { LlmClient } from '../src/services/llm-client.js';
import { makeTestConfig } from './helpers.js';

describe('complete', () => {
  it('marks the system prompt as an ephemeral cache breakpoint', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'hi' }],
      usage: { input_tokens: 3, output_tokens: 2 },
    });
    const client: LlmClient = { messages: { create } };

    await complete(client, makeTestConfig().llm, 'You are helpful.', 'Hi');

    const call = create.mock.calls[0][0];
    expect(call.system).toEqual([
      expect.objectContaining({
        type: 'text',
        text: 'You are helpful.',
        cache_control: { type: 'ephemeral' },
      }),
    ]);
  });

  it('extracts text and token usage', async () => {
    const client: LlmClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'result text' }],
          usage: { input_tokens: 5, output_tokens: 9 },
        }),
      },
    };

    const result = await complete(client, makeTestConfig().llm, 'sys', 'user');
    expect(result).toEqual({
      text: 'result text',
      inputTokens: 5,
      outputTokens: 9,
    });
  });
});

describe('parseJsonLoose', () => {
  it('parses a bare JSON object', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in a markdown fence with prose around it', () => {
    const text = 'Sure, here you go:\n```json\n{"a":1}\n```\nHope that helps!';
    expect(parseJsonLoose(text)).toEqual({ a: 1 });
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseJsonLoose('no json here')).toThrow();
  });
});
