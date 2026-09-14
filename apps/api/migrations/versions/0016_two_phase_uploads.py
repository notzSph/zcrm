"""add two-phase attachment uploads"""
from alembic import op
import sqlalchemy as sa

revision = "0016_two_phase_uploads"
down_revision = "0015_status_redaction"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_uploads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(160), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False, server_default="document"),
        sa.Column("status", sa.String(32), nullable=False, server_default="initiated"),
        sa.Column("storage_key", sa.String(255), unique=True),
        sa.Column("size_bytes", sa.Integer()),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("source", sa.String(64), nullable=False, server_default="user"),
        sa.Column("idempotency_key", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_lead_uploads_lead_id", "lead_uploads", ["lead_id"])
    op.create_index("ix_lead_uploads_status", "lead_uploads", ["status"])
    op.create_index("ix_lead_uploads_actor_user_id", "lead_uploads", ["actor_user_id"])
    op.create_index("ix_lead_uploads_idempotency_key", "lead_uploads", ["idempotency_key"])


def downgrade() -> None:
    for name in ("ix_lead_uploads_idempotency_key", "ix_lead_uploads_actor_user_id", "ix_lead_uploads_status", "ix_lead_uploads_lead_id"):
        op.drop_index(name, table_name="lead_uploads")
    op.drop_table("lead_uploads")
