"""Run all four Phase-2 analytics against the real data (data/import/*.csv)."""
import csv
import os
from collections import defaultdict
from analytics.risk import risk_score
from analytics.forecast import forecast
from analytics.sociodemographic import crime_by_age_band, urbanization_overlay
from analytics.decision_support import similar_cases, case_summary

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _read(name):
    with open(os.path.join(ROOT, "data", "import", name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    cases = _read("cases.csv")
    persons = {p["person_id"]: p for p in _read("persons.csv")}
    links = _read("case_persons.csv")
    districts = _read("districts.csv")
    case_by_id = {c["case_id"]: c for c in cases}

    # accused -> their cases
    accused_cases = defaultdict(list)
    for l in links:
        if l["role_in_case"] == "accused" and l["case_id"] in case_by_id:
            accused_cases[l["person_id"]].append(case_by_id[l["case_id"]])

    print("=== RISK SCORING (top 5 accused) ===")
    scored = [(pid, risk_score(cs)) for pid, cs in accused_cases.items()]
    for pid, r in sorted(scored, key=lambda x: -x[1]["score"])[:5]:
        print(f"  {pid}: risk {r['score']}  ({r['case_count']} cases, {len(r['districts'])} districts) "
              f"factors={r['factors']}")

    print("\n=== FORECASTING / EARLY WARNING (by crime_type) ===")
    for f in forecast(cases, key="crime_type")[:5]:
        flag = "  ⚠ EARLY WARNING" if f["early_warning"] else ""
        print(f"  {f['key']}: slope {f['trend_slope']:+} -> next {f['forecast_next']}{flag}")

    print("\n=== SOCIO-DEMOGRAPHIC (crime x age band) ===")
    accused_rows = []
    for pid, cs in accused_cases.items():
        age = persons.get(pid, {}).get("approx_age")
        for c in cs:
            accused_rows.append({"crime_type": c["crime_type"], "approx_age": age})
    for ct, bands in list(crime_by_age_band(accused_rows).items())[:4]:
        print(f"  {ct}: {bands}")
    print("  urbanization tiers (top 3 districts):",
          [d["district"] + ":" + d["tier"] for d in urbanization_overlay(districts)[:3]])

    print("\n=== DECISION SUPPORT (similar-case lookup) ===")
    target = case_by_id["C-5001"]
    sim = similar_cases(target, cases)
    print("  " + case_summary(target, sim))
    for s in sim[:4]:
        print(f"    -> {s['case_id']} {s['similarity']}% ({s['district']}, {s['status']})")


if __name__ == "__main__":
    main()
