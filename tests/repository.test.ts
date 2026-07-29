import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/models/db.js';
import { JobsRepository } from '../src/models/repository.js';

describe('JobsRepository', () => {
  it('creates a job in queued status', () => {
    const repo = new JobsRepository(createDatabase(':memory:'));
    const job = repo.createJob({ agentId: 'test.agent', input: { a: 1 } });

    expect(job.status).toBe('queued');
    expect(job.agent_id).toBe('test.agent');
    expect(JSON.parse(job.input)).toEqual({ a: 1 });
  });

  it('transitions through running to completed with a result', () => {
    const repo = new JobsRepository(createDatabase(':memory:'));
    const job = repo.createJob({ agentId: 'test.agent', input: {} });

    repo.markRunning(job.id);
    expect(repo.getJob(job.id).status).toBe('running');

    repo.markCompleted(job.id, {
      result: { score: 42 },
      inputTokens: 10,
      outputTokens: 5,
    });

    const completed = repo.getJob(job.id);
    expect(completed.status).toBe('completed');
    expect(JSON.parse(completed.result as string)).toEqual({ score: 42 });
    expect(completed.input_tokens).toBe(10);
    expect(completed.output_tokens).toBe(5);
  });

  it('records a failure with an error message', () => {
    const repo = new JobsRepository(createDatabase(':memory:'));
    const job = repo.createJob({ agentId: 'test.agent', input: {} });

    repo.markFailed(job.id, 'boom');

    const failed = repo.getJob(job.id);
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('boom');
  });

  it('throws for an unknown job id', () => {
    const repo = new JobsRepository(createDatabase(':memory:'));
    expect(() => repo.getJob(999)).toThrow();
  });

  it('filters jobs by agent and status', () => {
    const repo = new JobsRepository(createDatabase(':memory:'));
    const a = repo.createJob({ agentId: 'agent.a', input: {} });
    const b = repo.createJob({ agentId: 'agent.b', input: {} });
    repo.markCompleted(a.id, { result: {} });

    expect(repo.listJobs({ agentId: 'agent.a' })).toHaveLength(1);
    expect(repo.listJobs({ status: 'queued' }).map((j) => j.id)).toEqual([
      b.id,
    ]);
    expect(repo.listJobs()).toHaveLength(2);
  });
});
