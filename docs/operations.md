# zCRM operations

## Migration checks

Run these commands from the deployed repository before changing an existing database:

```bash
cd /opt/apps/zcrm
sudo docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T api alembic current
sudo docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T api alembic heads
```

The expected current head is `0008_business_profile`. Always create a backup first.
For a legacy database with the CRM tables already present but no `alembic_version`
row, inspect the schema against `apps/api/migrations/versions/0001_initial_crm_schema.py`
through `0008_business_profile.py`. Only after every revision is confirmed should an
operator stamp the matching revision; stamping skips SQL and must never be used as a
substitute for a schema comparison.

## Backup and restore

Backups use PostgreSQL's custom dump format and are written with mode `0600`:

```bash
./scripts/backup-db.sh /var/backups/zcrm
CONFIRM_RESTORE=yes ./scripts/restore-db.sh /var/backups/zcrm/zcrm-YYYYMMDDTHHMMSSZ.dump
```

Restore with application traffic stopped, then bring the stack back up so Alembic and
the readiness check run before the web service accepts traffic.
