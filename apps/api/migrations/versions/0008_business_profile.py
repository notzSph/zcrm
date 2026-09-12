"""add business profile metadata"""
from alembic import op
import sqlalchemy as sa

revision = "0008_business_profile"
down_revision = "0007_agent_idempotency"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("businesses", sa.Column("logo_url", sa.String(512), nullable=True))
    op.add_column("businesses", sa.Column("website", sa.String(512), nullable=True))
    op.add_column("businesses", sa.Column("industry", sa.String(120), nullable=True))
    op.add_column("businesses", sa.Column("description", sa.Text(), nullable=True))
    op.create_index("ix_businesses_industry", "businesses", ["industry"])

def downgrade() -> None:
    op.drop_index("ix_businesses_industry", table_name="businesses")
    op.drop_column("businesses", "description")
    op.drop_column("businesses", "industry")
    op.drop_column("businesses", "website")
    op.drop_column("businesses", "logo_url")
