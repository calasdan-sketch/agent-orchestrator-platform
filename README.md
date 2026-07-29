# Agent Orchestrator

A "project lead + worker agents" system: agents are role-scoped LLM workers
that pick up a job, do the work, and report a structured result back through
a database and admin API. It's designed to hold agent roles for more than one
line of business — it currently ships with dropshipping content/scoring
agents (ported from the `Repository-1` app) and a real-estate wholesale
lead-scoring agent — without those businesses needing to share code beyond
this common orchestration layer.

## Architecture

```
Job in  →  ProjectLead.assign(agentId, input)
              │
              ├─ looks up the agent in the registry (src/agents)
              ├─ runs it against the configured LLM (Anthropic or OpenRouter)
              └─ persists status + result/error + token usage to SQLite (jobs table)
                              │
                              ▼
                   GET /admin/jobs, /admin/jobs/:id
                   (this is how the project lead reviews what agents did)
```

- **`src/agents/`** — one file per agent role. Each exports an
  `AgentDefinition`: an id, a description, and a `run(input, ctx)` function
  that returns `{ output, inputTokens, outputTokens }`. Add a new agent by
  writing one of these and registering it in `src/agents/index.ts`.
- **`src/orchestrator/lead.ts`** — the `ProjectLead` class. `assign()` is the
  whole contract: create a job row, run the agent, write back whatever it
  reports (success + result, or failure + error message).
- **`src/services/llm.ts`** — shared completion helper. Every agent's system
  prompt is sent as an ephemeral prompt-cache breakpoint, so repeated calls
  with the same role instructions reuse cached input tokens. `CLAUDE_PROVIDER`
  can be switched to `openrouter` to route through OpenRouter instead of
  calling Anthropic directly.
- **`src/routes/admin.ts`** — the HTTP surface: list agents, assign jobs,
  list/inspect jobs.

## Built-in agents

| id | Does |
| --- | --- |
| `dropshipping.content-writer` | Generates SEO title/description/bullets/tags from a source product listing. |
| `dropshipping.product-scorer` | Scores a candidate product's dropshipping viability (0-100). |
| `real-estate.lead-scorer` | Scores a wholesale deal's numbers against the 70% rule (MAO = ARV × 0.70 − repairs) and estimates an assignment fee. |

**Note on the real-estate agent:** it scores numbers you already have — it
does not source leads or property data itself (no MLS/county-records
connector exists here). Its `legalNote` output always flags that contract
assignment and licensing rules vary by state/province and must be verified
locally (e.g. in Manitoba, real estate is regulated provincially — this tool
gives no jurisdiction-specific legal advice).

## Running it

```bash
cp .env.example .env   # set ANTHROPIC_API_KEY (or OPENROUTER_API_KEY + CLAUDE_PROVIDER=openrouter)
npm install
npm run dev
```

### Assign a job

```bash
curl -X POST localhost:3100/admin/jobs \
  -H 'content-type: application/json' \
  -d '{
    "agentId": "real-estate.lead-scorer",
    "input": {
      "address": "123 Example St, Winnipeg, MB",
      "askingPrice": 180000,
      "estimatedArv": 260000,
      "estimatedRepairCost": 35000,
      "jurisdiction": "Manitoba"
    }
  }'
```

### Check on the team

```bash
curl localhost:3100/admin/agents        # what agents exist
curl localhost:3100/admin/jobs          # every job and its status
curl localhost:3100/admin/jobs?status=failed
curl localhost:3100/admin/jobs/1        # one job's full report
```

## Scripts

- `npm run dev` — run with hot reload
- `npm test` — vitest
- `npm run typecheck` / `npm run lint` / `npm run format:check`
- `npm run build` — compile to `dist/`
