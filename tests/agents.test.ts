import { describe, expect, it, vi } from 'vitest';
import { contentWriterAgent } from '../src/agents/dropshipping/contentWriter.js';
import { productScorerAgent } from '../src/agents/dropshipping/productScorer.js';
import { leadScorerAgent } from '../src/agents/realEstate/leadScorer.js';
import type { LlmClient } from '../src/services/llm-client.js';
import { makeTestConfig } from './helpers.js';

function fakeClient(text: string): LlmClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    },
  };
}

const ctx = (client: LlmClient) => ({ client, config: makeTestConfig().llm });

describe('contentWriterAgent', () => {
  it('parses generated product content', async () => {
    const client = fakeClient(
      '{"title":"Premium Earbuds","description":"<p>Great</p>","bullets":["a"],"tags":["audio"]}',
    );
    const result = await contentWriterAgent.run(
      { title: 'Earbuds', price: 29.99 },
      ctx(client),
    );
    expect(result.output.title).toBe('Premium Earbuds');
    expect(result.inputTokens).toBe(10);
  });

  it('throws when required fields are missing', async () => {
    const client = fakeClient('{"description":"only desc"}');
    await expect(
      contentWriterAgent.run({ title: 'X', price: 1 }, ctx(client)),
    ).rejects.toThrow();
  });
});

describe('productScorerAgent', () => {
  it('clamps score to 0-100', async () => {
    const client = fakeClient('{"score": 150, "rationale": "high demand"}');
    const result = await productScorerAgent.run(
      { title: 'X', price: 1 },
      ctx(client),
    );
    expect(result.output.score).toBe(100);
  });
});

describe('leadScorerAgent', () => {
  it('scores a wholesale lead and includes a legal caveat', async () => {
    const client = fakeClient(
      JSON.stringify({
        maxAllowableOffer: 147000,
        suggestedAssignmentFee: 10000,
        score: 78,
        rationale: 'Good spread under the 70% rule.',
        legalNote:
          'Not legal advice; verify assignment/licensing rules with a Manitoba real-estate lawyer.',
      }),
    );
    const result = await leadScorerAgent.run(
      {
        address: '123 Example St, Winnipeg, MB',
        askingPrice: 150000,
        estimatedArv: 260000,
        estimatedRepairCost: 35000,
        jurisdiction: 'Manitoba',
      },
      ctx(client),
    );
    expect(result.output.maxAllowableOffer).toBe(147000);
    expect(result.output.legalNote).toMatch(/not legal advice/i);
  });

  it('clamps score to 0-100', async () => {
    const client = fakeClient(
      JSON.stringify({
        maxAllowableOffer: 0,
        suggestedAssignmentFee: 0,
        score: -5,
        rationale: 'Underwater.',
        legalNote: 'Not legal advice.',
      }),
    );
    const result = await leadScorerAgent.run(
      {
        address: 'x',
        askingPrice: 999999,
        estimatedArv: 100000,
        estimatedRepairCost: 50000,
      },
      ctx(client),
    );
    expect(result.output.score).toBe(0);
  });
});
