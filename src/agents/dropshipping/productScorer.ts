import { complete, parseJsonLoose } from '../../services/llm.js';
import type { AgentDefinition } from '../types.js';
import type { ProductInput } from './contentWriter.js';

export interface ProductScoreInput extends ProductInput {
  criteria?: string;
}

export interface ProductScore {
  score: number;
  rationale: string;
}

const SYSTEM =
  'You are a dropshipping product analyst. Respond ONLY with JSON: ' +
  '{score: number (0-100), rationale: string}.';

/** Ported from Repository-1's ClaudeService.scoreProduct. */
export const productScorerAgent: AgentDefinition<
  ProductScoreInput,
  ProductScore
> = {
  id: 'dropshipping.product-scorer',
  name: 'Product Viability Scorer',
  description:
    'Scores a candidate dropshipping product for margin potential, demand, and competition.',
  async run(input, ctx) {
    const criteria =
      input.criteria ?? 'margin potential, demand, and competition';
    const userPrompt = [
      `Evaluate this product against: ${criteria}.`,
      `Title: ${input.title}`,
      `Price: ${input.price}`,
      input.description ? `Description: ${input.description}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const { text, inputTokens, outputTokens } = await complete(
      ctx.client,
      ctx.config,
      SYSTEM,
      userPrompt,
    );
    const parsed = parseJsonLoose<ProductScore>(text);
    parsed.score = Math.max(0, Math.min(100, Number(parsed.score) || 0));

    return { output: parsed, inputTokens, outputTokens };
  },
};
