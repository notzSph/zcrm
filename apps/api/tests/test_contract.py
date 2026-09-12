from app.domain_models import InteractionType, LeadStatus, ReminderKind


def test_crm_contract_enums() -> None:
    assert {item.value for item in LeadStatus} >= {"contacted", "meeting", "proposal", "won", "lost"}
    assert "proposal_sent" in {item.value for item in InteractionType}
    assert "follow_up" in {item.value for item in ReminderKind}
