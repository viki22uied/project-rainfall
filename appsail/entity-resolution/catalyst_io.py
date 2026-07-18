"""Catalyst Data Store access (admin scope). Reads Persons, writes EntityMatches,
reads the held-out EvalGroundTruth (only this admin service may — no user role can)."""
from datetime import datetime, timezone


def _client():
    # Imported lazily so a missing/broken SDK can't crash app startup (/health).
    # AppSail requires the Flask request to bind the SDK's context.
    import zcatalyst_sdk
    from flask import request
    return zcatalyst_sdk.initialize(req=request)


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def load_persons():
    rows = _client().zcql().execute_query(
        "SELECT person_id, name_as_recorded FROM Persons")
    return [{"person_id": r["Persons"]["person_id"], "name": r["Persons"]["name_as_recorded"]}
            for r in rows]


def load_truth():
    rows = _client().zcql().execute_query(
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


def _find_match_row(client, person_a, person_b):
    """A candidate pair may not have a persisted EntityMatches row yet (the read-only
    /candidates preview doesn't write one) — look up either order, case_ids null-safe."""
    rows = client.zcql().execute_query(
        f"SELECT ROWID FROM EntityMatches WHERE "
        f"(person_a = '{person_a}' AND person_b = '{person_b}') OR "
        f"(person_a = '{person_b}' AND person_b = '{person_a}') ORDER BY CREATEDTIME DESC")
    return rows[0]["EntityMatches"]["ROWID"] if rows else None


def _cases_for(client, person_id):
    rows = client.zcql().execute_query(
        f"SELECT case_id, role_in_case FROM CasePersons WHERE person_id = '{person_id}'")
    return [(r["CasePersons"]["case_id"], r["CasePersons"]["role_in_case"]) for r in rows]


def confirm_match(person_a, person_b, decision, decided_by, confidence, method):
    """Human confirms or rejects a candidate identity match (no silent auto-merge — PRD).
    On confirm: the two identities' known cases become mutually linked, with the new rows
    tagged link_source='er_inferred' and match_ref pointing at the deciding EntityMatches
    row, so every inferred link is citable back to the decision that justified it."""
    if person_a == person_b:
        raise ValueError("person_a and person_b must differ")
    client = _client()
    match_table = client.datastore().table("EntityMatches")

    row_id = _find_match_row(client, person_a, person_b)
    if row_id:
        match_table.update_row({"ROWID": row_id, "status": decision, "decided_by": decided_by,
                                 "decided_at": _now()})
    else:
        row_id = match_table.insert_row({
            "person_a": person_a, "person_b": person_b, "confidence": confidence,
            "method": method, "status": decision, "decided_by": decided_by, "decided_at": _now(),
        })["ROWID"]

    links_created = 0
    if decision == "confirmed":
        cp_table = client.datastore().table("CasePersons")
        cases_a = _cases_for(client, person_a)
        cases_b = _cases_for(client, person_b)
        case_ids_a = {c for c, _ in cases_a}
        case_ids_b = {c for c, _ in cases_b}
        # person_b's cases the merged identity (person_a) isn't already linked to, and vice versa.
        for case_id, role in cases_b:
            if case_id not in case_ids_a:
                cp_table.insert_row({"case_id": case_id, "person_id": person_a, "role_in_case": role,
                                      "link_source": "er_inferred", "match_ref": row_id,
                                      "link_confidence": confidence})
                links_created += 1
        for case_id, role in cases_a:
            if case_id not in case_ids_b:
                cp_table.insert_row({"case_id": case_id, "person_id": person_b, "role_in_case": role,
                                      "link_source": "er_inferred", "match_ref": row_id,
                                      "link_confidence": confidence})
                links_created += 1

    return {"match_ref": row_id, "status": decision, "links_created": links_created}
