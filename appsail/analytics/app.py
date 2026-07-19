"""Phase-2 Analytics AppSail service.

  GET /health              liveness
  GET /risk                explainable offender risk scores (accused, ranked)
  GET /forecast?key=       crime forecasting / early-warning by crime_type or district_name
  GET /sociodemographic    crime x age-band + district urbanization tiers
  GET /decision-support?case_id=  similar-case lookup + summary
  GET /anomaly?key=        outlier months for a crime_type/district (z-score vs baseline)
  GET /timeline?case_id=   chronological event log for a case (FIR, links, AI actions)
  GET /leads?case_id=      ranked investigative-lead recommendations for a case
"""
import os
from collections import defaultdict
from flask import Flask, jsonify, request

from analytics.risk import risk_score
from analytics.forecast import forecast
from analytics.sociodemographic import crime_by_age_band, urbanization_overlay
from analytics.decision_support import similar_cases, case_summary
from analytics.anomaly import detect_anomalies
from analytics.timeline import build_timeline
from analytics.leads import generate_leads
import catalyst_io

app = Flask(__name__)


def _accused_index():
    cases = catalyst_io.load_cases()
    case_by_id = {c["case_id"]: c for c in cases}
    persons = {p["person_id"]: p for p in catalyst_io.load_persons()}
    accused = defaultdict(list)
    for link in catalyst_io.load_case_persons():
        if link["role_in_case"] == "accused" and link["case_id"] in case_by_id:
            accused[link["person_id"]].append(case_by_id[link["case_id"]])
    return cases, persons, accused


@app.route("/health")
def health():
    return jsonify(status="ok")


@app.route("/risk")
def risk():
    _, _, accused = _accused_index()
    scored = [{"person_id": pid, **risk_score(cs)} for pid, cs in accused.items()]
    scored.sort(key=lambda d: -d["score"])
    return jsonify(count=len(scored), top=scored[:20])


@app.route("/forecast")
def do_forecast():
    key = request.args.get("key", "crime_type")
    return jsonify(key=key, forecast=forecast(catalyst_io.load_cases(), key=key))


@app.route("/sociodemographic")
def socio():
    _, persons, accused = _accused_index()
    rows = []
    for pid, cs in accused.items():
        age = persons.get(pid, {}).get("approx_age")
        rows += [{"crime_type": c["crime_type"], "approx_age": age} for c in cs]
    return jsonify(crime_by_age_band=crime_by_age_band(rows),
                   urbanization=urbanization_overlay(catalyst_io.load_districts()))


@app.route("/decision-support")
def decision():
    case_id = request.args.get("case_id")
    cases = catalyst_io.load_cases()
    target = next((c for c in cases if c["case_id"] == case_id), None)
    if not target:
        return jsonify(error="case not found"), 404
    sim = similar_cases(target, cases)
    return jsonify(summary=case_summary(target, sim), similar=sim)


@app.route("/anomaly")
def anomaly_route():
    key = request.args.get("key", "crime_type")
    return jsonify(key=key, anomalies=detect_anomalies(catalyst_io.load_cases(), key=key))


@app.route("/timeline")
def timeline_route():
    case_id = request.args.get("case_id")
    cases = catalyst_io.load_cases()
    target = next((c for c in cases if c["case_id"] == case_id), None)
    if not target:
        return jsonify(error="case not found"), 404
    cps = [cp for cp in catalyst_io.load_case_persons() if cp["case_id"] == case_id]
    audit_rows = catalyst_io.load_audit_log(case_id)
    return jsonify(case_id=case_id, timeline=build_timeline(target, cps, audit_rows))


@app.route("/leads")
def leads_route():
    case_id = request.args.get("case_id")
    cases = catalyst_io.load_cases()
    case_by_id = {c["case_id"]: c for c in cases}
    target = case_by_id.get(case_id)
    if not target:
        return jsonify(error="case not found"), 404
    sim = similar_cases(target, cases)
    links = catalyst_io.load_case_persons()
    accused_cases = defaultdict(list)
    for link in links:
        if link["role_in_case"] == "accused" and link["case_id"] in case_by_id:
            accused_cases[link["person_id"]].append(case_by_id[link["case_id"]])
    accused_here = {l["person_id"] for l in links if l["case_id"] == case_id and l["role_in_case"] == "accused"}
    accused_risks = [(pid, risk_score(accused_cases[pid])) for pid in accused_here]
    anomalies = detect_anomalies(cases, key="crime_type")
    return jsonify(case_id=case_id, leads=generate_leads(target, sim, accused_risks, anomalies))


if __name__ == "__main__":
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", "9000"))
    app.run(host="0.0.0.0", port=port)
