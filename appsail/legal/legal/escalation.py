"""Mocked cross-agency escalation (PRD §5 scope boundaries). We DO NOT fake having
access to FIU-IND or NATGRID — access is legally gated. We generate a structured,
authenticated *request object* an authorized officer would submit, and refuse it
outright when the requester lacks the required rank."""

# Rank hierarchy (higher = more senior). NATGRID-style lookups require SP-rank+.
RANK_ORDER = {
    "Constable": 1, "Head Constable": 2, "Sub-Inspector": 3, "Inspector": 4,
    "Deputy SP": 5, "SP": 6, "DIG": 7, "IG": 8,
}
NATGRID_MIN_RANK = "SP"
FIU_MIN_RANK = "Deputy SP"


def _rank_ge(rank, minimum):
    return RANK_ORDER.get(rank, 0) >= RANK_ORDER.get(minimum, 999)


def _request(kind, subject, officer, min_rank, gate_note):
    if not _rank_ge(officer.get("rank"), min_rank):
        return {"status": "refused", "kind": kind, "reason": gate_note,
                "required_rank": min_rank, "requester_rank": officer.get("rank")}
    from datetime import datetime, timezone
    return {
        "status": "request_generated",     # a request object — NOT a live query result
        "simulated": True,
        "kind": kind,
        "subject": subject,
        "requested_by": {"name": officer.get("name"), "rank": officer.get("rank"),
                         "email": officer.get("email")},
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": gate_note,
    }


def fiu_ind_request(subject, officer):
    """Financial-transaction linkage is FIU-IND / PMLA gated. Emit a PMLA request object."""
    return _request("FIU-IND / PMLA financial linkage", subject, officer, FIU_MIN_RANK,
                    "Real access restricted to FIU-IND under PMLA; this is a structured request, not a live query.")


def natgrid_request(subject, officer):
    """Cross-agency lookup is NATGRID gated (SP-rank+). Emit an escalation request."""
    return _request("NATGRID cross-agency lookup", subject, officer, NATGRID_MIN_RANK,
                    "Access restricted to SP-rank+ officers by design; this is an escalation request, not a live query.")
