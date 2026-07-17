"""Catalyst Data Store access (admin scope). Reads Persons, writes EntityMatches,
reads the held-out EvalGroundTruth (only this admin service may — no user role can)."""
def _client():
    # Imported lazily so a missing/broken SDK can't crash app startup (/health).
    # AppSail requires the Flask request to bind the SDK's context.
    import zcatalyst_sdk
    from flask import request
    return zcatalyst_sdk.initialize(req=request)


def load_persons():
    rows = _client().zcql().execute_zcql_query(
        "SELECT person_id, name_as_recorded FROM Persons")
    return [{"person_id": r["Persons"]["person_id"], "name": r["Persons"]["name_as_recorded"]}
            for r in rows]


def load_truth():
    rows = _client().zcql().execute_zcql_query(
        "SELECT biz_id, truth_key FROM EvalGroundTruth WHERE entity_type = 'person'")
    return {r["EvalGroundTruth"]["biz_id"]: r["EvalGroundTruth"]["truth_key"] for r in rows}


def write_matches(matches):
    """Write candidate matches as 'pending' (no silent auto-merge — humans confirm)."""
    table = _client().datastore().table("EntityMatches")
    written = 0
    for m in matches:
        table.insert_row({
            "person_a": m["person_a"],
            "person_b": m["person_b"],
            "confidence": m["confidence"],
            "method": m["method"],
            "status": "pending",
        })
        written += 1
    return written
