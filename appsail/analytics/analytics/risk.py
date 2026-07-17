"""Offender risk scoring — explainable behavioral profiling.
Score 0..100 from three transparent factors, each returned with its contribution
so every score carries its own evidence trail (Requirement 14)."""

CRIME_SEVERITY = {
    "Robbery": 9, "Assault": 8, "House Break-in": 6, "Burglary": 6,
    "Chain Snatching": 5, "Vehicle Theft": 4, "Cheating/Fraud": 4, "Theft": 3,
}
WEIGHTS = {"repeat_offending": 0.40, "crime_severity": 0.35, "geographic_spread": 0.25}


def risk_score(person_cases):
    """person_cases: the cases linked to one accused (crime_type, district_name)."""
    if not person_cases:
        return {"score": 0, "case_count": 0, "factors": {}}
    n = len(person_cases)
    severities = [CRIME_SEVERITY.get((c.get("crime_type") or "").strip(), 3) for c in person_cases]
    districts = sorted({(c.get("district_name") or "").strip() for c in person_cases if c.get("district_name")})

    f_repeat = min(n / 5, 1.0)                       # 5+ cases -> maxed
    f_severity = max(severities) / 10
    f_spread = min((len(districts) - 1) / 3, 1.0) if districts else 0.0  # 4+ districts -> maxed

    contrib = {
        "repeat_offending": round(f_repeat * WEIGHTS["repeat_offending"] * 100),
        "crime_severity": round(f_severity * WEIGHTS["crime_severity"] * 100),
        "geographic_spread": round(f_spread * WEIGHTS["geographic_spread"] * 100),
    }
    return {
        "score": min(sum(contrib.values()), 100),
        "case_count": n,
        "districts": districts,
        "max_severity": max(severities),
        "factors": contrib,  # explainable breakdown
    }
