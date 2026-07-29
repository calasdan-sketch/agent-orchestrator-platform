import { UnknownAgentError } from '../lib/errors.js';
import type { AgentDefinition } from './types.js';

const registry = new Map<string, AgentDefinition>();

/** Register a worker agent so the project lead can assign it jobs. */
export function registerAgent(agent: AgentDefinition): void {
  registry.set(agent.id, agent);
}

/** Look up a registered agent by id, throwing if none exists. */
export function getAgent(id: string): AgentDefinition {
  const agent = registry.get(id);
  if (!agent) {
    throw new UnknownAgentError(`No agent registered with id "${id}"`);
  }
  return agent;
}

/** List every registered agent's public metadata (no run function). */
export function listAgents(): Array<
  Pick<AgentDefinition, 'id' | 'name' | 'description'>
> {
  return Array.from(registry.values()).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

/** Remove every registered agent. Intended for test isolation. */
export function resetRegistry(): void {
  registry.clear();
}
