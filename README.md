# zCRM

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

