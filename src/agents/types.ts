import type { AppConfig } from '../config/index.js';
import type { LlmClient } from '../services/llm-client.js';

/** Resources available to an agent while it runs a job. */
export interface AgentContext {
  client: LlmClient;
  config: AppConfig['llm'];
}

export interface AgentResult<TOutput> {
  output: TOutput;
  inputTokens: number;
  outputTokens: number;
}

/**
 * A single worker role: a stable id, a description for the project lead's
 * agent listing, and a `run` function that turns an input into a structured
 * result the lead can persist and report on.
 */
export interface AgentDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  run(input: TInput, ctx: AgentContext): Promise<AgentResult<TOutput>>;
}
