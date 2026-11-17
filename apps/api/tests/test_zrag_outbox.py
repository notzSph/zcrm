from datetime import UTC, datetime
import uuid

from app.domain_models import Interaction, InteractionType, Lead
from app.integrations.zrag_outbox import (
    enqueue_interaction_delete,
    enqueue_interaction_upsert,
)
from app.integrations.zrag_worker import _scope_signature


def make_records() -> tuple[Lead, Interaction]:
    business_id = uuid.uuid4()
    lead = Lead(id=uuid.uuid4(), business_id=business_id, company="Example Ltd")
    interaction = Interaction(
        id=uuid.uuid4(),
        lead_id=lead.id,
        interaction_type=InteractionType.note,
        body="Call next week",
        occurred_at=datetime(2026, 11, 16, 12, 0, tzinfo=UTC),
        revision=4,
    )
    return lead, interaction


def test_interaction_outbox_uses_stable_scoped_source_identity() -> None:
    lead, interaction = make_records()

    event = enqueue_interaction_upsert(lead, interaction)

    assert event.business_id == lead.business_id
    assert event.lead_id == lead.id
    assert event.interaction_id == interaction.id
    assert event.source_version == interaction.revision
    assert event.operation == "upsert"
    assert event.source_uri == (
        f"zcrm://business/{lead.business_id}/lead/{lead.id}/"
        f"interaction/{interaction.id}"
    )
    assert event.content == "note\nCall next week"


def test_delete_event_has_newer_version_and_no_content() -> None:
    lead, interaction = make_records()

    event = enqueue_interaction_delete(lead, interaction, interaction.revision + 1)

    assert event.operation == "delete"
    assert event.source_version == interaction.revision + 1
    assert event.content is None


def test_scope_signature_binds_entity_version_and_operation() -> None:
    lead, interaction = make_records()
    event = enqueue_interaction_upsert(lead, interaction)
    signature = _scope_signature(event, "secret")

    event.operation = "delete"

    assert _scope_signature(event, "secret") != signature
