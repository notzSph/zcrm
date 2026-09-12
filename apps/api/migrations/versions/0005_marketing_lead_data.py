"""add marketing lead fields and interactions"""
from alembic import op
import sqlalchemy as sa

revision = "0005_marketing_lead_data"
down_revision = "0004_business_owners"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("leads", sa.Column("contact_phone", sa.String(64), nullable=True)); op.add_column("leads", sa.Column("linkedin_url", sa.String(512), nullable=True)); op.add_column("leads", sa.Column("source", sa.String(120), nullable=True)); op.add_column("leads", sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json"))); op.add_column("leads", sa.Column("estimated_value", sa.Numeric(12, 2), nullable=True)); op.add_column("leads", sa.Column("external_ref", sa.String(255), nullable=True))
    op.create_index("ix_leads_source", "leads", ["source"]); op.create_index("ix_leads_external_ref", "leads", ["external_ref"])
    op.create_table("interactions", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False), sa.Column("interaction_type", sa.Enum("reply", "message", "call", "meeting", "proposal_sent", "note", "other", name="interaction_type"), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.Column("external_ref", sa.String(255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_interactions_lead_id", "interactions", ["lead_id"]); op.create_index("ix_interactions_interaction_type", "interactions", ["interaction_type"]); op.create_index("ix_interactions_occurred_at", "interactions", ["occurred_at"]); op.create_index("ix_interactions_external_ref", "interactions", ["external_ref"])

def downgrade() -> None:
    op.drop_table("interactions"); op.drop_index("ix_leads_external_ref", table_name="leads"); op.drop_index("ix_leads_source", table_name="leads")
    for column in ("external_ref", "estimated_value", "tags", "source", "linkedin_url", "contact_phone"): op.drop_column("leads", column)
