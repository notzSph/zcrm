"""initial CRM schema"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("email", sa.String(320), nullable=False), sa.Column("display_name", sa.String(180), nullable=False), sa.Column("password_hash", sa.String(512), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table("businesses", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("name", sa.String(180), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_businesses_name", "businesses", ["name"])
    op.create_table("business_memberships", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("business_id", sa.Uuid(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.UniqueConstraint("user_id", "business_id", name="ux_business_memberships_user_business"))
    op.create_index("ix_business_memberships_user_id", "business_memberships", ["user_id"]); op.create_index("ix_business_memberships_business_id", "business_memberships", ["business_id"])
    op.create_table("user_sessions", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("token_hash", sa.String(64), nullable=False), sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("active_business_id", sa.Uuid(), sa.ForeignKey("businesses.id", ondelete="SET NULL")), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_user_sessions_token_hash", "user_sessions", ["token_hash"], unique=True); op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"]); op.create_index("ix_user_sessions_active_business_id", "user_sessions", ["active_business_id"])
    op.create_table("leads", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("business_id", sa.Uuid(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False), sa.Column("company", sa.String(180), nullable=False), sa.Column("contact_name", sa.String(180)), sa.Column("contact_email", sa.String(320)), sa.Column("status", sa.Enum("connected", "contacted", "meeting", "proposal", "won", "lost", "nurture", name="leadstatus"), nullable=False), sa.Column("next_action", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_leads_business_id", "leads", ["business_id"]); op.create_index("ix_leads_company", "leads", ["company"]); op.create_index("ix_leads_status", "leads", ["status"])
    op.create_table("reminders", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False), sa.Column("title", sa.String(280), nullable=False), sa.Column("kind", sa.Enum("follow_up", "meeting", "proposal", "check_in", "other", name="reminder_kind"), nullable=False), sa.Column("due_at", sa.DateTime(timezone=True), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_reminders_lead_id", "reminders", ["lead_id"]); op.create_index("ix_reminders_kind", "reminders", ["kind"]); op.create_index("ix_reminders_due_at", "reminders", ["due_at"])
    op.create_table("activities", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False), sa.Column("event_type", sa.Enum("lead_created", "status_changed", "lead_updated", "reminder_created", "reminder_completed", "reminder_updated", "reminder_deleted", name="activity_type"), nullable=False), sa.Column("payload", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_activities_lead_id", "activities", ["lead_id"]); op.create_index("ix_activities_event_type", "activities", ["event_type"]); op.create_index("ix_activities_created_at", "activities", ["created_at"])

def downgrade() -> None:
    for table in ("activities", "reminders", "leads", "user_sessions", "business_memberships", "businesses", "users"): op.drop_table(table)
