"""add versioned lead transitions and attachment redaction"""
from alembic import op
import sqlalchemy as sa

revision = "0015_status_redaction"
down_revision = "0014_api_idempotency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("lead_attachments", sa.Column("status", sa.String(32), nullable=False, server_default="completed"))
    op.create_index("ix_lead_attachments_status", "lead_attachments", ["status"])


def downgrade() -> None:
    op.drop_index("ix_lead_attachments_status", table_name="lead_attachments")
    op.drop_column("lead_attachments", "status")
    op.drop_column("leads", "version")
