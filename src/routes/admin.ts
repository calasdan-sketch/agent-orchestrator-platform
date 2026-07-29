import express, { type Request, type Response, type Router } from 'express';
import { listAgents } from '../agents/index.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { createLogger } from '../lib/logger.js';
import type { JobStatus } from '../models/repository.js';
import { ProjectLead } from '../orchestrator/lead.js';

const log = createLogger('admin');

const VALID_STATUSES: JobStatus[] = [
  'queued',
  'running',
  'completed',
  'failed',
];

/**
 * Build the admin API router: assign jobs to agents and inspect what they
 * reported back. This is how the project lead (a human, or this session on a
 * check-in) monitors the agent team.
 */
export function createAdminRouter(
  lead: ProjectLead = new ProjectLead(),
): Router {
  const router = express.Router();
  router.use(createRateLimiter({ max: 100 }));
  router.use(express.json());

  // List every registered agent role.
  router.get('/agents', (_req: Request, res: Response) => {
    res.json({ agents: listAgents() });
  });

  // Assign a job to an agent and wait for its report.
  router.post('/jobs', async (req: Request, res: Response) => {
    const { agentId, input } = req.body ?? {};
    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    try {
      const job = await lead.assign(agentId, input ?? {});
      res.status(201).json({ job });
    } catch (error) {
      log.error({ err: String(error) }, 'Failed to assign job');
      res.status(400).json({ error: 'failed to assign job' });
    }
  });

  // List jobs, optionally filtered by agent and/or status.
  router.get('/jobs', (req: Request, res: Response) => {
    const { agentId, status } = req.query;
    if (status && !VALID_STATUSES.includes(status as JobStatus)) {
      res.status(400).json({ error: 'invalid status' });
      return;
    }
    const jobs = lead.listJobs({
      agentId: typeof agentId === 'string' ? agentId : undefined,
      status: typeof status === 'string' ? (status as JobStatus) : undefined,
    });
    res.json({ jobs });
  });

  // Get a single job's full report.
  router.get('/jobs/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    try {
      res.json({ job: lead.getJob(id) });
    } catch {
      res.status(404).json({ error: 'job not found' });
    }
  });

  return router;
}
