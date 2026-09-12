"""add lead description"""
from alembic import op
import sqlalchemy as sa

revision = "0010_lead_description"
down_revision = "0009_target_lead_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "description")
