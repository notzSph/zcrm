"""add API idempotency records"""
from alembic import op
import sqlalchemy as sa

revision = "0014_api_idempotency"
down_revision = "0013_timeline_contract"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_idempotency",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("business_id", sa.Uuid(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope_key", sa.String(255), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False, server_default="201"),
        sa.Column("response_body", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("business_id", "scope_key", name="ux_api_idempotency_business_scope"),
    )
    op.create_index("ix_api_idempotency_business_id", "api_idempotency", ["business_id"])


def downgrade() -> None:
    op.drop_index("ix_api_idempotency_business_id", table_name="api_idempotency")
    op.drop_table("api_idempotency")
