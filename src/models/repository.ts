import type Database from 'better-sqlite3';
import { getDb } from './db.js';
import { NotFoundError } from '../lib/errors.js';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobRow {
  id: number;
  agent_id: string;
  status: JobStatus;
  input: string;
  result: string | null;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Datastore access for orchestrator jobs: the record of every task handed to
 * an agent, its status, and what it reported back.
 */
export class JobsRepository {
  constructor(private readonly db: Database.Database = getDb()) {}

  createJob(input: { agentId: string; input: unknown }): JobRow {
    const result = this.db
      .prepare(
        `INSERT INTO jobs (agent_id, status, input)
         VALUES (@agentId, 'queued', @input)`,
      )
      .run({
        agentId: input.agentId,
        input: JSON.stringify(input.input),
      });

    return this.getJob(Number(result.lastInsertRowid));
  }

  markRunning(id: number): void {
    this.db
      .prepare(
        `UPDATE jobs SET status = 'running', updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({ id });
  }

  markCompleted(
    id: number,
    output: { result: unknown; inputTokens?: number; outputTokens?: number },
  ): void {
    this.db
      .prepare(
        `UPDATE jobs
         SET status = 'completed',
             result = @result,
             input_tokens = @inputTokens,
             output_tokens = @outputTokens,
             updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({
        id,
        result: JSON.stringify(output.result),
        inputTokens: output.inputTokens ?? null,
        outputTokens: output.outputTokens ?? null,
      });
  }

  markFailed(id: number, error: string): void {
    this.db
      .prepare(
        `UPDATE jobs SET status = 'failed', error = @error, updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({ id, error });
  }

  getJob(id: number): JobRow {
    const row = this.db
      .prepare(`SELECT * FROM jobs WHERE id = @id`)
      .get({ id }) as JobRow | undefined;
    if (!row) {
      throw new NotFoundError(`Job ${id} not found`);
    }
    return row;
  }

  listJobs(filter: { agentId?: string; status?: JobStatus } = {}): JobRow[] {
    const clauses: string[] = [];
    const params: Record<string, string> = {};

    if (filter.agentId) {
      clauses.push('agent_id = @agentId');
      params.agentId = filter.agentId;
    }
    if (filter.status) {
      clauses.push('status = @status');
      params.status = filter.status;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db
      .prepare(`SELECT * FROM jobs ${where} ORDER BY id DESC`)
      .all(params) as JobRow[];
  }
}
