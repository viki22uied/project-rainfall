"""Entity Resolution AppSail service.

  GET  /health          liveness
  POST /resolve         run ER over Persons, write candidate matches as 'pending'
  GET  /evaluate        run ER + score against EvalGroundTruth (admin-only held-out data)
"""
import os
from flask import Flask, jsonify, request

from er.resolve import resolve
from er.metrics import true_pairs, prf1
import catalyst_io

app = Flask(__name__)
DEFAULT_THRESHOLD = int(os.environ.get("ER_THRESHOLD", "95"))

app_flask = app  # AppSail looks for a module-level `app`


@app.route("/health")
def health():
    return jsonify(status="ok")


@app.route("/resolve", methods=["POST"])
def do_resolve():
    threshold = int(request.args.get("threshold", DEFAULT_THRESHOLD))
    persons = catalyst_io.load_persons()
    matches = resolve(persons, threshold)
    written = catalyst_io.write_matches(matches)
    return jsonify(persons=len(persons), candidates=len(matches),
                   written=written, threshold=threshold, status="pending")


@app.route("/candidates")
def do_candidates():
    """Ranked candidate matches enriched with recorded names, for human review.
    No write — read-only view of what /resolve would surface (pending confirmation)."""
    threshold = int(request.args.get("threshold", DEFAULT_THRESHOLD))
    limit = int(request.args.get("limit", 12))
    persons = catalyst_io.load_persons()
    name_by = {p["person_id"]: p["name"] for p in persons}
    matches = resolve(persons, threshold)[:limit]
    for m in matches:
        m["name_a"] = name_by.get(m["person_a"], m["person_a"])
        m["name_b"] = name_by.get(m["person_b"], m["person_b"])
    return jsonify(threshold=threshold, count=len(matches), candidates=matches)


@app.route("/confirm", methods=["POST"])
def do_confirm():
    """Human confirms or rejects a candidate match (no silent auto-merge — PRD).
    Confirming links each identity's known cases to the other, tagged link_source
    'er_inferred' with match_ref citing the deciding EntityMatches row."""
    b = request.get_json(force=True, silent=True) or {}
    for f in ("person_a", "person_b", "decision"):
        if not b.get(f):
            return jsonify(error=f"missing {f}"), 400
    if b["decision"] not in ("confirmed", "rejected"):
        return jsonify(error="decision must be confirmed or rejected"), 400
    result = catalyst_io.confirm_match(
        b["person_a"], b["person_b"], b["decision"],
        b.get("decided_by", ""), b.get("confidence", 0), b.get("method", "composite"))
    return jsonify(result)


@app.route("/evaluate")
def do_evaluate():
    threshold = int(request.args.get("threshold", DEFAULT_THRESHOLD))
    persons = catalyst_io.load_persons()
    truth = catalyst_io.load_truth()
    ranked = resolve(persons, threshold=0)
    gold = true_pairs(truth)
    pred = {frozenset((m["person_a"], m["person_b"])) for m in ranked if m["confidence"] >= threshold}
    return jsonify(threshold=threshold, persons=len(persons),
                   candidate_pairs=len(ranked), true_pairs=len(gold),
                   **prf1(pred, gold))


if __name__ == "__main__":
    # AppSail supplies the port to bind on via this env var.
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", "9000"))
    app.run(host="0.0.0.0", port=port)
