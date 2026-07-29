import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAgent, resetRegistry } from '../src/agents/registry.js';
import type { AgentDefinition } from '../src/agents/types.js';
import { createDatabase } from '../src/models/db.js';
import { JobsRepository } from '../src/models/repository.js';
import { ProjectLead } from '../src/orchestrator/lead.js';
import { createAdminRouter } from '../src/routes/admin.js';
import type { LlmClient } from '../src/services/llm-client.js';
import { makeTestConfig } from './helpers.js';

const echoAgent: AgentDefinition<{ n: number }, { n: number }> = {
  id: 'test.echo',
  name: 'Echo agent',
  description: 'returns its input unchanged',
  async run(input) {
    return { output: input, inputTokens: 1, outputTokens: 1 };
  },
};

async function startAdminApp() {
  const jobs = new JobsRepository(createDatabase(':memory:'));
  const lead = new ProjectLead({
    config: makeTestConfig(),
    jobs,
    client: {} as LlmClient,
  });

  const app = express();
  app.use('/admin', createAdminRouter(lead));

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe('admin routes', () => {
  const servers: Server[] = [];

  beforeEach(() => {
    resetRegistry();
    registerAgent(echoAgent);
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }
              resolve();
            });
          }),
      ),
    );
  });

  it('lists registered agents', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    const response = await fetch(`${url}/admin/agents`);
    const body = (await response.json()) as { agents: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.agents.map((a) => a.id)).toContain('test.echo');
  });

  it('assigns a job and returns its completed report', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    const response = await fetch(`${url}/admin/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId: 'test.echo', input: { n: 7 } }),
    });
    const body = (await response.json()) as {
      job: { status: string; result: string };
    };

    expect(response.status).toBe(201);
    expect(body.job.status).toBe('completed');
    expect(JSON.parse(body.job.result)).toEqual({ n: 7 });
  });

  it('rejects a job assignment missing agentId', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    const response = await fetch(`${url}/admin/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    });
    expect(response.status).toBe(400);
  });

  it('lists jobs and filters by status', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    await fetch(`${url}/admin/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId: 'test.echo', input: { n: 1 } }),
    });

    const response = await fetch(`${url}/admin/jobs?status=completed`);
    const body = (await response.json()) as { jobs: unknown[] };
    expect(response.status).toBe(200);
    expect(body.jobs).toHaveLength(1);
  });

  it('rejects an invalid status filter', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    const response = await fetch(`${url}/admin/jobs?status=bogus`);
    expect(response.status).toBe(400);
  });

  it('gets a single job by id, 404s for missing', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    const created = await fetch(`${url}/admin/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId: 'test.echo', input: { n: 2 } }),
    });
    const { job } = (await created.json()) as { job: { id: number } };

    const found = await fetch(`${url}/admin/jobs/${job.id}`);
    expect(found.status).toBe(200);

    const missing = await fetch(`${url}/admin/jobs/999999`);
    expect(missing.status).toBe(404);
  });
});
