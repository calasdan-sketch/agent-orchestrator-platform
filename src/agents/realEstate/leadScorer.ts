import { complete, parseJsonLoose } from '../../services/llm.js';
import type { AgentDefinition } from '../types.js';

export interface WholesaleLeadInput {
  address: string;
  askingPrice: number;
  /** After-repair value. */
  estimatedArv: number;
  estimatedRepairCost: number;
  sellerMotivation?: string;
  /** State/province the property sits in, for the legal caveat. */
  jurisdiction?: string;
}

export interface WholesaleLeadScore {
  maxAllowableOffer: number;
  suggestedAssignmentFee: number;
  score: number;
  rationale: string;
  legalNote: string;
}

const SYSTEM =
  'You are a real-estate wholesale deal analyst. Apply the 70% rule ' +
  '(MAO = ARV * 0.70 - repair costs) to judge assignability and estimate a ' +
  'reasonable assignment fee. Respond ONLY with JSON: ' +
  '{maxAllowableOffer: number, suggestedAssignmentFee: number, ' +
  'score: number (0-100), rationale: string, legalNote: string}. ' +
  'legalNote must state plainly that this is not legal advice, and that ' +
  'contract-assignment marketing and licensing rules vary by state/' +
  'province and must be verified with a local real-estate attorney or ' +
  'regulator before acting.';

/**
 * First real-estate agent role: given a lead's numbers, estimates a max
 * allowable offer and assignment fee. Deliberately does NOT attempt to
 * source leads itself (no property-data connector exists here) — it scores
 * whatever numbers you already have.
 */
export const leadScorerAgent: AgentDefinition<
  WholesaleLeadInput,
  WholesaleLeadScore
> = {
  id: 'real-estate.lead-scorer',
  name: 'Wholesale Lead Scorer',
  description:
    'Scores a prospective wholesale deal against the 70% rule and flags jurisdiction-specific legal considerations.',
  async run(input, ctx) {
    const userPrompt = [
      `Address: ${input.address}`,
      `Asking price: ${input.askingPrice}`,
      `Estimated ARV: ${input.estimatedArv}`,
      `Estimated repair cost: ${input.estimatedRepairCost}`,
      input.sellerMotivation
        ? `Seller motivation: ${input.sellerMotivation}`
        : '',
      `Jurisdiction: ${input.jurisdiction ?? 'unspecified'}`,
    ]
      .filter(Boolean)
      .join('\n');

    const { text, inputTokens, outputTokens } = await complete(
      ctx.client,
      ctx.config,
      SYSTEM,
      userPrompt,
    );
    const parsed = parseJsonLoose<WholesaleLeadScore>(text);
    parsed.score = Math.max(0, Math.min(100, Number(parsed.score) || 0));

    return { output: parsed, inputTokens, outputTokens };
  },
};
