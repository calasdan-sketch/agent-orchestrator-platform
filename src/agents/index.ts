import { contentWriterAgent } from './dropshipping/contentWriter.js';
import { productScorerAgent } from './dropshipping/productScorer.js';
import { leadScorerAgent } from './realEstate/leadScorer.js';
import { registerAgent } from './registry.js';

export { getAgent, listAgents, resetRegistry } from './registry.js';
export type { AgentContext, AgentDefinition, AgentResult } from './types.js';

/** Register every built-in agent role. Call once at startup (or per-test). */
export function registerBuiltinAgents(): void {
  registerAgent(contentWriterAgent);
  registerAgent(productScorerAgent);
  registerAgent(leadScorerAgent);
}
