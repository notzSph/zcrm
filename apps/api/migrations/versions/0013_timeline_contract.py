"""add timeline recording metadata"""
from alembic import op
import sqlalchemy as sa

revision = "0013_timeline_contract"
down_revision = "0012_reminder_calendar_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SEQUENCE timeline_recorded_seq"))
    for table in ("activities", "interactions", "lead_attachments"):
        op.add_column(table, sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
        op.add_column(table, sa.Column("source", sa.String(64), nullable=False, server_default="system" if table == "activities" else "user"))
        op.add_column(table, sa.Column("revision", sa.Integer(), nullable=False, server_default="1"))
        op.add_column(table, sa.Column("redacted", sa.Boolean(), nullable=False, server_default=sa.false()))
        op.add_column(table, sa.Column("recorded_seq", sa.BigInteger(), nullable=True))
        op.execute(sa.text(f"UPDATE {table} SET recorded_seq = nextval('timeline_recorded_seq') WHERE recorded_seq IS NULL"))
        op.alter_column(table, "recorded_seq", nullable=False, server_default=sa.text("nextval('timeline_recorded_seq')"))
        op.create_index(f"ix_{table}_actor_user_id", table, ["actor_user_id"])
        op.create_index(f"ix_{table}_recorded_seq", table, ["recorded_seq"])


def downgrade() -> None:
    for table in ("lead_attachments", "interactions", "activities"):
        op.drop_index(f"ix_{table}_recorded_seq", table_name=table)
        op.drop_index(f"ix_{table}_actor_user_id", table_name=table)
        for column in ("recorded_seq", "redacted", "revision", "source", "actor_user_id"):
            op.drop_column(table, column)
    op.execute(sa.text("DROP SEQUENCE timeline_recorded_seq"))
