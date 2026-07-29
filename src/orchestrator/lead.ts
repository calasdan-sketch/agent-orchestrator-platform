import { getAgent } from '../agents/index.js';
import { type AppConfig, loadConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import {
  type JobRow,
  JobsRepository,
  type JobStatus,
} from '../models/repository.js';
import { createLlmClient } from '../services/llm.js';
import type { LlmClient } from '../services/llm-client.js';

const log = createLogger('project-lead');

/**
 * Coordinates work across registered agents. Assigning a job runs the agent
 * synchronously and persists a structured report (status, result or error,
 * token usage) that can be queried afterwards — this is the "report back to
 * the project lead" contract every agent honours regardless of what it does.
 */
export class ProjectLead {
  private readonly config: AppConfig['llm'];
  private readonly jobs: JobsRepository;
  private client: LlmClient | null;

  constructor(options?: {
    config?: AppConfig;
    jobs?: JobsRepository;
    client?: LlmClient;
  }) {
    const config = options?.config ?? loadConfig();
    this.config = config.llm;
    this.jobs = options?.jobs ?? new JobsRepository();
    // Lazy so the app can start without an API key configured.
    this.client = options?.client ?? null;
  }

  private getClient(): LlmClient {
    if (!this.client) {
      this.client = createLlmClient(this.config);
    }
    return this.client;
  }

  /** Assign a job to an agent, run it, and persist whatever it reports back. */
  async assign(agentId: string, input: unknown): Promise<JobRow> {
    const agent = getAgent(agentId);
    const job = this.jobs.createJob({ agentId, input });
    this.jobs.markRunning(job.id);

    try {
      const { output, inputTokens, outputTokens } = await agent.run(input, {
        client: this.getClient(),
        config: this.config,
      });
      this.jobs.markCompleted(job.id, {
        result: output,
        inputTokens,
        outputTokens,
      });
      log.info({ jobId: job.id, agentId }, 'Agent reported completion');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.jobs.markFailed(job.id, message);
      log.error(
        { jobId: job.id, agentId, error: message },
        'Agent reported failure',
      );
    }

    return this.jobs.getJob(job.id);
  }

  listJobs(filter: { agentId?: string; status?: JobStatus } = {}): JobRow[] {
    return this.jobs.listJobs(filter);
  }

  getJob(id: number): JobRow {
    return this.jobs.getJob(id);
  }
}
