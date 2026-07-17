"""Investigator decision support: similar-case lookup by MO signature + a templated
(non-LLM) case summary. Self-contained so it can deploy independently."""

MO_FEATURES = ("crime_type", "entry_method", "weapon", "target_type", "time_band")


def _feat(c, f):
    return (c.get(f) or "").strip()


def _similarity(a, b):
    m = sum(1 for f in MO_FEATURES if _feat(a, f) and _feat(a, f) == _feat(b, f))
    return m / len(MO_FEATURES)


def similar_cases(target, cases, top_n=5, min_sim=0.6):
    scored = []
    for c in cases:
        if c.get("case_id") == target.get("case_id"):
            continue
        s = _similarity(target, c)
        if s >= min_sim:
            shared = [f for f in MO_FEATURES if _feat(target, f) and _feat(target, f) == _feat(c, f)]
            scored.append({"case_id": c.get("case_id"), "similarity": round(s * 100),
                           "shared_features": shared, "district": c.get("district_name"),
                           "status": c.get("status")})
    scored.sort(key=lambda d: -d["similarity"])
    return scored[:top_n]


def case_summary(case, similar):
    base = (f"Case {case.get('case_id')} ({case.get('crime_type')}) at "
            f"{case.get('district_name')} — status {case.get('status')}.")
    if not similar:
        return base + " No similar-MO cases found."
    top = similar[0]
    return (base + f" {len(similar)} similar-MO case(s); strongest {top['case_id']} "
            f"({top['similarity']}% match on {', '.join(top['shared_features'])}).")
