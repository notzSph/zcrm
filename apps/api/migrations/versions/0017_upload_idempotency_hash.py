"""bind upload idempotency keys to request payloads"""
from alembic import op
import sqlalchemy as sa

revision = "0017_upload_idempotency_hash"
down_revision = "0016_two_phase_uploads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lead_uploads", sa.Column("request_hash", sa.String(64)))


def downgrade() -> None:
    op.drop_column("lead_uploads", "request_hash")
