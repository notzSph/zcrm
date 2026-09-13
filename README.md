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
   random `JAYZOO_API_KEY` too.

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

The current deployable basic CRM includes SMTP password-reset delivery, a PostgreSQL
integration smoke test, and explicit backup/restore scripts.

### Operations

Create a database backup from the Docker host:

```bash
./scripts/backup-db.sh /var/backups/zcrm
```

Restore only after stopping application traffic and confirming the target backup:

```bash
CONFIRM_RESTORE=yes ./scripts/restore-db.sh /var/backups/zcrm/zcrm-YYYYMMDDTHHMMSSZ.dump
```

Run the PostgreSQL smoke test against an already migrated integration database:

```bash
cd apps/api
RUN_POSTGRES_TESTS=1 DATABASE_URL='postgresql+psycopg://...' pytest -q
```

Password reset delivery uses SMTP. Set `PUBLIC_APP_URL`, `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_STARTTLS`
in `infra/.env`. Reset responses never expose tokens; links are sent by email.

CalDAV reminder sync is disabled by default. To sync zCRM reminders to an iCloud
calendar, set `CALDAV_ENABLED=true`, then fill in `CALDAV_USERNAME`,
`CALDAV_APP_PASSWORD`, and `CALDAV_CALENDAR_NAME` in `infra/.env`. The app-specific
password is generated from Apple Account settings; do not use the normal Apple
Account password. Creating or updating a reminder writes a timed event, and
deleting a reminder removes its synced event.

After restarting the stack, verify discovery with `GET /api/v1/calendar/caldav`
while logged in. A successful response includes the discovered calendar URL.
