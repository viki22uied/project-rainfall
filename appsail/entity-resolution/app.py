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
