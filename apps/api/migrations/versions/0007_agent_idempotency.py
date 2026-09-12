"""add agent idempotency references to reminders"""
from alembic import op
import sqlalchemy as sa

revision = "0007_agent_idempotency"
down_revision = "0006_lead_attachments"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("reminders", sa.Column("external_ref", sa.String(255), nullable=True)); op.create_index("ix_reminders_external_ref", "reminders", ["external_ref"])

def downgrade() -> None:
    op.drop_index("ix_reminders_external_ref", table_name="reminders"); op.drop_column("reminders", "external_ref")
