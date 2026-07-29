import { beforeEach, describe, expect, it } from 'vitest';
import { registerAgent, resetRegistry } from '../src/agents/registry.js';
import type { AgentDefinition } from '../src/agents/types.js';
import { createDatabase } from '../src/models/db.js';
import { JobsRepository } from '../src/models/repository.js';
import { ProjectLead } from '../src/orchestrator/lead.js';
import type { LlmClient } from '../src/services/llm-client.js';
import { makeTestConfig } from './helpers.js';

const okAgent: AgentDefinition<{ n: number }, { doubled: number }> = {
  id: 'test.ok',
  name: 'OK agent',
  description: 'doubles a number',
  async run(input) {
    return {
      output: { doubled: input.n * 2 },
      inputTokens: 1,
      outputTokens: 1,
    };
  },
};

const failingAgent: AgentDefinition = {
  id: 'test.fail',
  name: 'Failing agent',
  description: 'always throws',
  async run() {
    throw new Error('deliberate failure');
  },
};

describe('ProjectLead', () => {
  beforeEach(() => {
    resetRegistry();
    registerAgent(okAgent);
    registerAgent(failingAgent);
  });

  it('runs an agent and persists its reported result', async () => {
    const jobs = new JobsRepository(createDatabase(':memory:'));
    const lead = new ProjectLead({
      config: makeTestConfig(),
      jobs,
      client: {} as LlmClient,
    });

    const job = await lead.assign('test.ok', { n: 21 });

    expect(job.status).toBe('completed');
    expect(JSON.parse(job.result as string)).toEqual({ doubled: 42 });
  });

  it('persists a failure report instead of throwing', async () => {
    const jobs = new JobsRepository(createDatabase(':memory:'));
    const lead = new ProjectLead({
      config: makeTestConfig(),
      jobs,
      client: {} as LlmClient,
    });

    const job = await lead.assign('test.fail', {});

    expect(job.status).toBe('failed');
    expect(job.error).toContain('deliberate failure');
  });

  it('throws for an unregistered agent id before creating a job', async () => {
    const jobs = new JobsRepository(createDatabase(':memory:'));
    const lead = new ProjectLead({
      config: makeTestConfig(),
      jobs,
      client: {} as LlmClient,
    });

    await expect(lead.assign('does.not.exist', {})).rejects.toThrow();
    expect(jobs.listJobs()).toHaveLength(0);
  });

  it('lists jobs filtered by status', async () => {
    const jobs = new JobsRepository(createDatabase(':memory:'));
    const lead = new ProjectLead({
      config: makeTestConfig(),
      jobs,
      client: {} as LlmClient,
    });

    await lead.assign('test.ok', { n: 1 });
    await lead.assign('test.fail', {});

    expect(lead.listJobs({ status: 'completed' })).toHaveLength(1);
    expect(lead.listJobs({ status: 'failed' })).toHaveLength(1);
  });

  it('creates its own client lazily when none is provided', () => {
    const jobs = new JobsRepository(createDatabase(':memory:'));
    expect(
      () => new ProjectLead({ config: makeTestConfig(), jobs }),
    ).not.toThrow();
  });
});
