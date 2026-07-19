"""Investigative-lead recommendations: a synthesis layer over ER/MO/risk/anomaly
outputs already computed elsewhere — no new ML, just prioritized next-actions.
Human confirms every lead before acting on it (same posture as ER matches)."""

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def generate_leads(case, similar, accused_risks, anomalies):
    leads = []
    if case.get("status") == "Unsolved":
        for s in similar[:3]:
            leads.append({"priority": "high" if s["similarity"] >= 80 else "medium",
                          "action": f"Review MO overlap with {s['case_id']} ({s['similarity']}% match) — possible same offender."})
    for pid, r in accused_risks:
        if r.get("score", 0) >= 70:
            leads.append({"priority": "high",
                          "action": f"Escalate: accused {pid} risk score {r['score']} (spread across {len(r.get('districts', []))} districts)."})
    case_type = case.get("crime_type")
    for a in anomalies:
        if a["key"] == case_type:
            leads.append({"priority": "medium",
                          "action": f"Crime-type spike detected for {a['key']} in {a['month']} (z={a['z_score']}) — check for a cluster."})
    if not leads:
        leads.append({"priority": "low", "action": "No strong signals — continue standard investigation steps."})
    leads.sort(key=lambda l: PRIORITY_ORDER[l["priority"]])
    return leads
