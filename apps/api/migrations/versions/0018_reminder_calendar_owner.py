"""associate reminders with their calendar owner"""
from alembic import op
import sqlalchemy as sa

revision = "0018_reminder_owner"
down_revision = "0017_upload_idempotency_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("owner_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_reminders_owner_user_id", "reminders", ["owner_user_id"])


def downgrade() -> None:
    op.drop_index("ix_reminders_owner_user_id", table_name="reminders")
    op.drop_column("reminders", "owner_user_id")
