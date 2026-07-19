"""Chronological event log per case: FIR filing, person links, and every AI
action taken on the case (from the hash-chained AuditLog) — a synthesis over
existing data, no new table."""


def build_timeline(case, case_persons, audit_rows):
    events = []
    if case.get("incident_date"):
        events.append({"ts": case["incident_date"], "type": "fir_filed",
                        "detail": f"FIR filed — {case.get('crime_type', '')} at {case.get('district_name', '')}"})
    for cp in case_persons:
        events.append({"ts": case.get("incident_date", ""), "type": "person_linked",
                        "detail": f"{cp.get('role_in_case')} linked (person {cp.get('person_id')})"})
    for a in audit_rows:
        events.append({"ts": a.get("ts", ""), "type": "ai_action",
                        "detail": f"{a.get('action')} by {a.get('actor_role')} — {a.get('decision')}"})
    events.sort(key=lambda e: e.get("ts") or "")
    return events
