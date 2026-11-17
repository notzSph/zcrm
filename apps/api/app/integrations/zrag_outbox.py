from __future__ import annotations

from datetime import UTC

from app.domain_models import Interaction, Lead, ZragOutbox


def interaction_source_uri(lead: Lead, interaction: Interaction) -> str:
    return (
        f"zcrm://business/{lead.business_id}/lead/{lead.id}/"
        f"interaction/{interaction.id}"
    )


def enqueue_interaction_upsert(
    lead: Lead,
    interaction: Interaction,
) -> ZragOutbox:
    occurred_at = interaction.occurred_at
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=UTC)
    content = f"{interaction.interaction_type.value}\n{interaction.body.strip()}"
    event = ZragOutbox(
        business_id=lead.business_id,
        lead_id=lead.id,
        interaction_id=interaction.id,
        source_version=interaction.revision,
        operation="upsert",
        source_uri=interaction_source_uri(lead, interaction),
        title=f"{interaction.interaction_type.value} · {occurred_at.isoformat()}",
        media_type="text/plain",
        content=content,
        occurred_at=occurred_at,
    )
    return event


def enqueue_interaction_delete(
    lead: Lead,
    interaction: Interaction,
    version: int | None = None,
) -> ZragOutbox:
    occurred_at = interaction.occurred_at
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=UTC)
    return ZragOutbox(
        business_id=lead.business_id,
        lead_id=lead.id,
        interaction_id=interaction.id,
        source_version=version if version is not None else interaction.revision,
        operation="delete",
        source_uri=interaction_source_uri(lead, interaction),
        title=f"deleted interaction {interaction.id}",
        media_type="text/plain",
        content=None,
        occurred_at=occurred_at,
    )
