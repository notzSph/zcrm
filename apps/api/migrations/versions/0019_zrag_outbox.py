"""Add durable events for zRAG synchronization."""

from alembic import op
import sqlalchemy as sa


revision = "0019_zrag_outbox"
down_revision = "0018_reminder_owner"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "zrag_outbox",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("interaction_id", sa.Uuid(), nullable=False),
        sa.Column("source_version", sa.Integer(), nullable=False),
        sa.Column("operation", sa.String(16), nullable=False),
        sa.Column("source_uri", sa.String(1024), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("media_type", sa.String(160), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("claimed_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("operation IN ('upsert', 'delete')", name="ck_zrag_outbox_operation"),
        sa.CheckConstraint("status IN ('pending', 'processing', 'done', 'dead')", name="ck_zrag_outbox_status"),
        sa.CheckConstraint("source_version > 0", name="ck_zrag_outbox_version"),
        sa.UniqueConstraint("interaction_id", "source_version", "operation", name="ux_zrag_outbox_interaction_version_operation"),
    )
    op.create_index(
        "ix_zrag_outbox_ready",
        "zrag_outbox",
        ["status", "available_at", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_zrag_outbox_ready", table_name="zrag_outbox")
    op.drop_table("zrag_outbox")
