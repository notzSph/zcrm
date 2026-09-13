"""add structured calendar fields to reminders"""

from alembic import op
import sqlalchemy as sa

revision = "0012_reminder_calendar_fields"
down_revision = "0011_caldav_reminder_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("location", sa.String(length=512), nullable=True))
    op.add_column("reminders", sa.Column("duration_minutes", sa.Integer(), server_default="30", nullable=False))
    op.add_column("reminders", sa.Column("travel_minutes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("reminders", sa.Column("alarm_minutes_before", sa.JSON(), server_default=sa.text("'[120, 60]'"), nullable=False))


def downgrade() -> None:
    op.drop_column("reminders", "alarm_minutes_before")
    op.drop_column("reminders", "travel_minutes")
    op.drop_column("reminders", "duration_minutes")
    op.drop_column("reminders", "location")
