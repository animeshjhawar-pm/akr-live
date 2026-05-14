# SFN Dashboard

Local + Vercel-deployable dashboard for monitoring Stormbreaker Step Functions executions across all `stormbreaker-*` state machines in `us-east-1` (account `465512941999`). Resolves `project_id` → project name from the prod Postgres DB.

---

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind (SPA, served as static files).
- **Backend**: FastAPI app (`app.py`) exposed as a single Vercel Python serverless function via `api/index.py`. Locally it runs under uvicorn.
- **Vercel routing**: `vercel.json` rewrites all `/api/*` traffic to `api/index.py`; FastAPI handles internal routing. Everything else is served from the built frontend in `frontend/dist`.

---

## Local development

```bash
cp .env.example .env   # fill in AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
make install
make dev
```

Open http://localhost:5173 (Vite dev server, proxies `/api` → uvicorn on `:8765`).

---

## Deploy to Vercel

The repo is configured to deploy directly: https://github.com/animeshjhawar-pm/akr-live.git

### 1. Push the code

```bash
cd sfn-dashboard
git init
git add .
git commit -m "Initial commit: SFN dashboard"
git remote add origin https://github.com/animeshjhawar-pm/akr-live.git
git branch -M main
git push -u origin main
```

### 2. Import the repo in Vercel

- New Project → Import `animeshjhawar-pm/akr-live`.
- Framework preset: **Other** (settings in `vercel.json` take precedence).
- Vercel will:
  - run `pip install -r requirements.txt` (Python deps for the serverless function),
  - run `cd frontend && npm install && npm run build` (frontend),
  - serve `frontend/dist` as static, and route `/api/*` to the Python function.

### 3. Set environment variables in Vercel (Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | (your IAM key with `states:*` read perms) |
| `AWS_SECRET_ACCESS_KEY` | (matching secret) |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | `465512941999` |
| `DB_URL` | `postgres://read_access_only:...@gw-rds-prod.celzx4qnlkfp.us-east-1.rds.amazonaws.com:5432/gw_stormbreaker` |
| `STATE_MACHINE_PREFIX` | `stormbreaker-` (optional, default) |

Add to **Production** and **Preview** environments.

### 4. Network requirements

- The RDS host `gw-rds-prod.celzx4qnlkfp.us-east-1.rds.amazonaws.com` must be reachable from Vercel's serverless egress IPs. Verify the RDS instance has a publicly accessible endpoint and its security group allows inbound `5432` from `0.0.0.0/0` (or from Vercel's IP ranges). If not, the deploy will return DB errors and you'll need to put a connection proxy in front (e.g. PgBouncer on a public-accessible EC2 / API Gateway).
- The IAM user used for `AWS_ACCESS_KEY_ID` only needs read perms: `states:ListStateMachines`, `states:ListExecutions`, `states:DescribeExecution`, `states:GetExecutionHistory`.

### 5. Deploy

`git push` to `main` triggers a build. The first cold-start of the Python function takes ~3–5s (boto3 + psycopg2 import); subsequent warm requests are fast.

---

## Features

- **Running** tab — all in-flight executions across every `stormbreaker-*` state machine, with the current step extracted from execution history.
- **Failed** tab — `FAILED` / `TIMED_OUT` / `ABORTED` executions in the selected time window, with failed step name, error type, and message.
- Project names resolved from `gw_stormbreaker.projects` (batched UUID lookup).
- Time window: 1h / 6h / 24h / 3d / 7d (default) / 14d / 30d.
- Auto-refresh: Off / 30s / 1m / 2m / **5m (default)**.
- State machine multi-select filter.
- Click row → expand to see full input JSON, error message, console deep link, redrive count.
- All filter/refresh settings persist in `localStorage`.

---

## Notes / caveats

- Read-only — never writes to AWS or DB.
- Failed-execution history is cached in-memory (executions are immutable). On Vercel this cache is per-container and resets on cold start — still saves work within a warm function.
- Running-execution history is cached 60s to avoid throttling on auto-refresh.
- Vercel function `maxDuration` is set to 60s. If you watch many state machines with many running executions, response times can grow; consider narrowing the SM multi-select filter.
- No auth in front of the deployed dashboard. If the URL is public, **anyone with the URL can see project data**. Add Vercel Password Protection (paid) or wrap behind a separate auth layer if you care.
