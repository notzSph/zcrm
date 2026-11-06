import os
import uuid

import pytest
from fastapi import HTTPException

from app.security import agent_business_scope


JAYZOO_KEY = "jayzoo-test-key"
SPINACH_ID = uuid.UUID("51cb6c28-e6c6-46a3-8baa-2ed98aae0c03")
FORARTS_ID = uuid.UUID("6d781d4d-fb96-4050-8475-61ee680b2b94")


def test_jayzoo_key_supports_multiple_businesses(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JAYZOO_API_KEY", JAYZOO_KEY)
    monkeypatch.setenv("JAYZOO_BUSINESS_IDS", f"{SPINACH_ID}, {FORARTS_ID}")

    scope = agent_business_scope(JAYZOO_KEY)

    assert scope == frozenset({SPINACH_ID, FORARTS_ID})


def test_single_business_variable_remains_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JAYZOO_API_KEY", JAYZOO_KEY)
    monkeypatch.delenv("JAYZOO_BUSINESS_IDS", raising=False)
    monkeypatch.setenv("JAYZOO_BUSINESS_ID", str(SPINACH_ID))

    assert agent_business_scope(JAYZOO_KEY) == SPINACH_ID


def test_invalid_business_allowlist_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JAYZOO_API_KEY", JAYZOO_KEY)
    monkeypatch.setenv("JAYZOO_BUSINESS_IDS", f"{SPINACH_ID},not-a-uuid")

    with pytest.raises(HTTPException, match="invalid business ID"):
        agent_business_scope(JAYZOO_KEY)
