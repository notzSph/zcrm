"""add business membership roles"""
from alembic import op
import sqlalchemy as sa

revision = "0003_membership_roles"
down_revision = "0002_profile_fields"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("business_memberships", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute(sa.text("UPDATE business_memberships bm SET is_admin = TRUE WHERE bm.id IN (SELECT DISTINCT ON (business_id) id FROM business_memberships ORDER BY business_id, id)"))

def downgrade() -> None:
    op.drop_column("business_memberships", "is_admin")
