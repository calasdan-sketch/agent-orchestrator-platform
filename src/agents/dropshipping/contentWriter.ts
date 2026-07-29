import { complete, parseJsonLoose } from '../../services/llm.js';
import type { AgentDefinition } from '../types.js';

export interface ProductInput {
  title: string;
  description?: string;
  price: number;
}

export interface GeneratedProductContent {
  title: string;
  description: string;
  bullets: string[];
  tags: string[];
}

const SYSTEM =
  'You are an expert e-commerce copywriter. Produce accurate, ' +
  'non-misleading, SEO-optimised product content. Respond ONLY with ' +
  'JSON: {title: string, description: string (HTML allowed), ' +
  'bullets: string[], tags: string[]}.';

/**
 * Ported from Repository-1's ClaudeService.generateProductContent, adapted to
 * the shared agent interface so it can be assigned jobs by the project lead
 * alongside non-dropshipping agents.
 */
export const contentWriterAgent: AgentDefinition<
  ProductInput,
  GeneratedProductContent
> = {
  id: 'dropshipping.content-writer',
  name: 'Product Content Writer',
  description:
    'Generates SEO product titles/descriptions/bullets/tags from a source listing.',
  async run(input, ctx) {
    const userPrompt = [
      'Create marketing content for this product:',
      `Source title: ${input.title}`,
      input.description ? `Source description: ${input.description}` : '',
      `Price: ${input.price}`,
    ]
      .filter(Boolean)
      .join('\n');

    const { text, inputTokens, outputTokens } = await complete(
      ctx.client,
      ctx.config,
      SYSTEM,
      userPrompt,
    );
    const parsed = parseJsonLoose<GeneratedProductContent>(text);

    if (!parsed.title || !parsed.description) {
      throw new Error('Generated content missing required fields');
    }
    parsed.bullets = parsed.bullets ?? [];
    parsed.tags = parsed.tags ?? [];

    return { output: parsed, inputTokens, outputTokens };
  },
};
