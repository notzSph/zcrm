from app.integrations.lead_briefing import _trusted_citations


def test_citations_are_built_only_from_retrieved_sources() -> None:
    evidence = [
        {
            "chunk_id": "chunk-a",
            "source": {"uri": "zcrm://source/a", "title": "Call note"},
            "locator": {"interaction_id": "interaction-a"},
        },
        {"chunk_id": "", "source": {"uri": ""}},
    ]

    citations = _trusted_citations(evidence)

    assert citations == {
        "chunk-a": {
            "chunk_id": "chunk-a",
            "source_uri": "zcrm://source/a",
            "title": "Call note",
            "locator": {"interaction_id": "interaction-a"},
        }
    }
