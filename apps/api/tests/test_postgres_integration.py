import os

import pytest
from sqlalchemy import create_engine, inspect, text


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS") != "1",
    reason="set RUN_POSTGRES_TESTS=1 to run against the configured PostgreSQL database",
)


def test_postgres_schema_is_reachable_and_migrated() -> None:
    database_url = os.environ["DATABASE_URL"]
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar_one() == 1
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0008_business_profile"
        tables = set(inspect(engine).get_table_names())
        assert {"users", "businesses", "leads", "reminders", "interactions", "lead_attachments"} <= tables
    finally:
        engine.dispose()
