"""add explicit business owners"""
from alembic import op
import sqlalchemy as sa

revision = "0004_business_owners"
down_revision = "0003_membership_roles"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("businesses", sa.Column("owner_id", sa.Uuid(), nullable=True))
    op.create_index("ix_businesses_owner_id", "businesses", ["owner_id"])
    op.create_foreign_key("fk_businesses_owner_id_users", "businesses", "users", ["owner_id"], ["id"], ondelete="SET NULL")
    op.execute(sa.text("UPDATE businesses b SET owner_id = (SELECT bm.user_id FROM business_memberships bm WHERE bm.business_id = b.id AND bm.is_admin = TRUE ORDER BY bm.created_at, bm.id LIMIT 1)"))

def downgrade() -> None:
    op.drop_constraint("fk_businesses_owner_id_users", "businesses", type_="foreignkey")
    op.drop_index("ix_businesses_owner_id", table_name="businesses")
    op.drop_column("businesses", "owner_id")
