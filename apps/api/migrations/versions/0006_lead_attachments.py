"""add lead attachments"""
from alembic import op
import sqlalchemy as sa

revision = "0006_lead_attachments"
down_revision = "0005_marketing_lead_data"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("lead_attachments", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False), sa.Column("filename", sa.String(255), nullable=False), sa.Column("storage_key", sa.String(255), nullable=False), sa.Column("content_type", sa.String(160), nullable=False), sa.Column("size_bytes", sa.Integer(), nullable=False), sa.Column("kind", sa.String(64), nullable=False, server_default="document"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.UniqueConstraint("storage_key"))
    op.create_index("ix_lead_attachments_lead_id", "lead_attachments", ["lead_id"]); op.create_index("ix_lead_attachments_kind", "lead_attachments", ["kind"]); op.create_index("ix_lead_attachments_created_at", "lead_attachments", ["created_at"])

def downgrade() -> None:
    op.drop_table("lead_attachments")
