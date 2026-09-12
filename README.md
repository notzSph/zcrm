# zCRM

![Version](https://img.shields.io/badge/version-0.5.0b-blue)
![Frontend](https://img.shields.io/badge/frontend-Next.js-black)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Database](https://img.shields.io/badge/database-PostgreSQL-336791)
![License](https://img.shields.io/badge/license-proprietary-red)

**Release:** `v0.5.0b` — internal beta freeze.

A lean CRM for tracking outbound opportunities, their pipeline status, and follow-ups.

## Stack

- Next.js + SCSS (`apps/web`)
- FastAPI (`apps/api`)
- PostgreSQL

## Run locally

1. Create the environment file:

   ```bash
   cp infra/.env.example infra/.env
   ```

2. Generate a password hash for the first user:

   ```bash
   cd apps/api
   python -m app.scripts.hash_password
   ```

3. Put the resulting hash in `infra/.env` as `ADMIN_PASSWORD_HASH`. Set a long
   random `JWT_SECRET` and `JAYZOO_API_KEY` too.

4. Start the stack:

   ```bash
   docker compose -f infra/docker-compose.yml up --build -d
   ```

5. Open <http://localhost:3200>.

The API is bound to `127.0.0.1:8200`; the web app is bound to
`127.0.0.1:3200` so an Nginx reverse proxy can expose it safely.

## API automation

Use `X-API-Key: <JAYZOO_API_KEY>` for agent automation. Browser requests use
the secure session created at login.

Useful endpoints:

- `GET /api/v1/leads`
- `POST /api/v1/leads`
- `PATCH /api/v1/leads/{lead_id}`
- `POST /api/v1/leads/{lead_id}/reminders`
- `GET /api/v1/reminders?bucket=overdue|today|upcoming`

Agent operations use `X-API-Key` and `X-Business-ID`:

- `GET /api/v1/agent/capabilities`
- `PUT /api/v1/agent/leads` — upsert by `external_ref`
- `PATCH /api/v1/agent/leads/{lead_id}/status`
- `POST /api/v1/agent/leads/{lead_id}/interactions` — deduplicates by `external_ref`
- `POST /api/v1/agent/leads/{lead_id}/reminders` — deduplicates by `external_ref`
- `POST /api/v1/leads/{lead_id}/attachments` — multipart upload, also supports agent headers

See [`docs/agent-workflow.md`](docs/agent-workflow.md) for the Discord-to-CRM operating
playbook and retry-safe `external_ref` convention.

## Backend structure

The API follows the same layered layout as zTrading:

- `apps/api/app/core` – database and settings
- `apps/api/app/api/v1` – auth, business context, and CRM routes
- `apps/api/app/models` and `apps/api/app/schemas` – public model/schema packages
- `apps/api/migrations` – Alembic revisions

Docker applies migrations before starting the API. For an existing database created by
the pre-Alembic build, back it up and stamp or reconcile its schema before deploying;
the initial revision is intended for a fresh database.

The current deployable basic CRM still needs production email delivery for password
resets, automated tests against PostgreSQL, and an explicit backup/restore process.
