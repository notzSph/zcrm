from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import logging
import os
import time
import urllib.error
import urllib.request
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert

from app.core.db import SessionLocal
from app.domain_models import Interaction, Lead, ZragOutbox
from app.integrations.zrag_outbox import enqueue_interaction_upsert


logger = logging.getLogger("zcrm.zrag_worker")
POLL_SECONDS = 2
LEASE_MINUTES = 5
MAX_ATTEMPTS = 12


def _scope_signature(event: ZragOutbox, secret: str) -> str:
    canonical = "\n".join(
        (
            str(event.business_id),
            "lead",
            str(event.lead_id),
            "interaction",
            str(event.interaction_id),
            str(event.source_version),
            event.operation,
        )
    )
    return hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def _deliver(event: ZragOutbox) -> None:
    base_url = os.environ["Z_RAG_INGEST_URL"].rstrip("/")
    token = os.environ["Z_RAG_INGEST_TOKEN"]
    scope_secret = os.environ["Z_RAG_SCOPE_SECRET"]
    payload = {
        "business_id": str(event.business_id),
        "lead_id": str(event.lead_id),
        "interaction_id": str(event.interaction_id),
        "source_version": event.source_version,
        "source_uri": event.source_uri,
        "title": event.title,
        "media_type": event.media_type,
        "occurred_at": event.occurred_at.isoformat(),
    }
    if event.operation == "upsert":
        payload["content"] = event.content
    body = json.dumps(payload, separators=(",", ":")).encode()
    request = urllib.request.Request(
        f"{base_url}/v1/crm/sources/{event.operation}",
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Zrag-Ingest-Token": token,
            "X-Zrag-Scope-Signature": _scope_signature(event, scope_secret),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()


def _claim_one() -> ZragOutbox | None:
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        event = db.scalar(
            select(ZragOutbox)
            .where(
                ZragOutbox.available_at <= now,
                or_(
                    ZragOutbox.status == "pending",
                    (ZragOutbox.status == "processing")
                    & (ZragOutbox.claimed_at < now - timedelta(minutes=LEASE_MINUTES)),
                ),
            )
            .order_by(ZragOutbox.created_at, ZragOutbox.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if event is None:
            return None
        event.status = "processing"
        event.claimed_at = now
        event.last_error = None
        db.flush()
        db.expunge(event)
        return event


def _finish(event_id: uuid.UUID, error: Exception | None) -> None:
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        event = db.get(ZragOutbox, event_id)
        if event is None or event.status != "processing":
            return
        if error is None:
            event.status = "done"
            event.completed_at = now
            event.claimed_at = None
            event.last_error = None
            event.content = None
            return

        event.attempts += 1
        event.claimed_at = None
        event.last_error = f"{type(error).__name__}: {error}"[:500]
        if event.attempts >= MAX_ATTEMPTS:
            event.status = "dead"
            logger.error("zRAG outbox event %s moved to dead state", event.id)
            return
        event.status = "pending"
        delay = min(300, 2 ** min(event.attempts, 8))
        event.available_at = now + timedelta(seconds=delay)
        logger.warning(
            "zRAG outbox event %s failed, attempt %s, retry in %ss: %s",
            event.id,
            event.attempts,
            delay,
            type(error).__name__,
        )


def process_one() -> bool:
    event = _claim_one()
    if event is None:
        return False
    error: Exception | None = None
    try:
        _deliver(event)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
        error = exc
    _finish(event.id, error)
    return True


def backfill() -> int:
    inserted = 0
    with SessionLocal() as db:
        records = db.execute(
            select(Interaction, Lead)
            .join(Lead, Interaction.lead_id == Lead.id)
            .where(Interaction.redacted.is_(False))
            .order_by(Interaction.created_at, Interaction.id)
        ).all()
        for interaction, lead in records:
            event = enqueue_interaction_upsert(lead, interaction)
            statement = insert(ZragOutbox).values(
                id=uuid.uuid4(),
                business_id=event.business_id,
                lead_id=event.lead_id,
                interaction_id=event.interaction_id,
                source_version=event.source_version,
                operation=event.operation,
                source_uri=event.source_uri,
                title=event.title,
                media_type=event.media_type,
                content=event.content,
                occurred_at=event.occurred_at,
            ).on_conflict_do_nothing(
                constraint="ux_zrag_outbox_interaction_version_operation"
            )
            result = db.execute(statement)
            inserted += result.rowcount or 0
        db.commit()
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Synchronize CRM interaction events to zRAG.")
    parser.add_argument("--backfill", action="store_true")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

    if args.backfill:
        count = backfill()
        logger.info("queued %s existing interactions for zRAG indexing", count)
        if args.once:
            return

    while True:
        if not process_one():
            if args.once:
                return
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
