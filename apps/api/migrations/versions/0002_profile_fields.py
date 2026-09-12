"""add user profile and password reset fields"""
from alembic import op
import sqlalchemy as sa

revision = "0002_profile_fields"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("users", sa.Column("profile_pic", sa.String(512), nullable=True)); op.add_column("users", sa.Column("reset_token", sa.String(128), nullable=True)); op.add_column("users", sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True)); op.create_index("ix_users_reset_token", "users", ["reset_token"])

def downgrade() -> None:
    op.drop_index("ix_users_reset_token", table_name="users"); op.drop_column("users", "reset_token_expires_at"); op.drop_column("users", "reset_token"); op.drop_column("users", "profile_pic")
