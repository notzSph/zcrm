"""store CalDAV event identifiers for reminders"""

from alembic import op
import sqlalchemy as sa

revision = "0011_caldav_reminder_events"
down_revision = "0010_lead_description"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("caldav_uid", sa.String(length=255), nullable=True))
    op.add_column("reminders", sa.Column("caldav_url", sa.String(length=1024), nullable=True))
    op.create_index("ix_reminders_caldav_uid", "reminders", ["caldav_uid"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_reminders_caldav_uid", table_name="reminders")
    op.drop_column("reminders", "caldav_url")
    op.drop_column("reminders", "caldav_uid")
