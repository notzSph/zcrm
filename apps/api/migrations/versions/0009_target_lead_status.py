"""add target as the initial lead status"""
from alembic import op

revision = "0009_target_lead_status"
down_revision = "0008_business_profile"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("ALTER TYPE leadstatus ADD VALUE IF NOT EXISTS 'target' BEFORE 'connected'")

def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place.
    pass
