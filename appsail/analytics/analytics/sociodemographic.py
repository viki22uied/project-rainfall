"""Socio-demographic crime correlation: age-band x crime-type breakdown, and a
district urbanization/intensity overlay from the real 2022 aggregate stats."""
from collections import defaultdict


def age_band(age):
    try:
        a = int(age)
    except (TypeError, ValueError):
        return "unknown"
    if a < 25:
        return "18-24"
    if a < 35:
        return "25-34"
    if a < 45:
        return "35-44"
    if a < 55:
        return "45-54"
    return "55+"


def crime_by_age_band(accused_records):
    """accused_records: rows with crime_type + approx_age (accused persons joined to cases)."""
    table = defaultdict(lambda: defaultdict(int))
    for r in accused_records:
        table[(r.get("crime_type") or "").strip()][age_band(r.get("approx_age"))] += 1
    return {ct: dict(bands) for ct, bands in table.items() if ct}


def urbanization_overlay(districts):
    """districts: rows with district_name + total_cases (real 2022 stats).
    Tiers by crime intensity as an urbanization proxy."""
    # drop summary/total rows that aren't real districts
    real = [d for d in districts if "total" not in (d.get("district_name") or "").lower()]
    ranked = sorted(real, key=lambda d: -int(d.get("total_cases") or 0))
    n = len(ranked) or 1
    out = []
    for i, d in enumerate(ranked):
        tier = "high" if i < n / 3 else "medium" if i < 2 * n / 3 else "low"
        out.append({"district": d.get("district_name"),
                    "total_cases": int(d.get("total_cases") or 0), "tier": tier})
    return out
