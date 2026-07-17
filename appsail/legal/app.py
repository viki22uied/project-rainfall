"""Phase-3 Legal-weight AppSail service.

  GET  /health              liveness
  POST /seal                hash-stamp an AI output -> evidence record (persisted)
  POST /certificate         auto-draft the BSA 2023 Section 63 certificate
  POST /explain             wrap an AI output with its explanation + evidence hash
  POST /escalate/fiu        FIU-IND / PMLA request object (rank-gated, simulated)
  POST /escalate/natgrid    NATGRID escalation request (SP-rank+, simulated)
  POST /export              encrypted conversation transcript
"""
import os
from flask import Flask, jsonify, request

from legal.evidence import seal, bsa63_certificate
from legal.escalation import fiu_ind_request, natgrid_request
from legal.explain import explain
from legal.export import build_document, encrypt

app = Flask(__name__)


def _body():
    return request.get_json(force=True, silent=True) or {}


@app.route("/health")
def health():
    return jsonify(status="ok")


@app.route("/seal", methods=["POST"])
def do_seal():
    b = _body()
    ev = seal(b.get("artifact_type", "match"), b.get("inputs", {}), b.get("output", {}),
              b.get("reasoning_trail", []))
    try:
        import catalyst_io
        catalyst_io.write_evidence(ev)
        ev["persisted"] = True
    except Exception:  # noqa: BLE001 — persistence is best-effort; the seal still stands
        ev["persisted"] = False
    return jsonify(ev)


@app.route("/certificate", methods=["POST"])
def do_cert():
    b = _body()
    return jsonify(bsa63_certificate(b["evidence"], b.get("custodian", {}), b.get("expert", {})))


@app.route("/explain", methods=["POST"])
def do_explain():
    b = _body()
    return jsonify(explain(b.get("artifact_type", "match"), b.get("inputs", {}),
                           b.get("output", {}), b.get("factors", [])))


@app.route("/escalate/fiu", methods=["POST"])
def esc_fiu():
    b = _body()
    return jsonify(fiu_ind_request(b.get("subject", {}), b.get("officer", {})))


@app.route("/escalate/natgrid", methods=["POST"])
def esc_natgrid():
    b = _body()
    return jsonify(natgrid_request(b.get("subject", {}), b.get("officer", {})))


@app.route("/export", methods=["POST"])
def do_export():
    b = _body()
    doc = build_document(b.get("conversation", []), b.get("meta", {}))
    return jsonify(encrypt(doc, b.get("password", "")))


if __name__ == "__main__":
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", "9000"))
    app.run(host="0.0.0.0", port=port)
