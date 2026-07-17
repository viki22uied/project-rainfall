"""Persist sealed evidence to the EvidenceRecords table (admin scope)."""
import json


def write_evidence(ev):
    import zcatalyst_sdk
    from flask import request
    client = zcatalyst_sdk.initialize(req=request)
    client.datastore().table("EvidenceRecords").insert_row({
        "artifact_type": ev["artifact_type"],
        "artifact_ref": ev.get("artifact_ref", ""),
        "input_hash": ev["input_hash"],
        "output_hash": ev["output_hash"],
        "reasoning_trail": json.dumps(ev["reasoning_trail"]),
        "generated_at": ev["generated_at"].replace("T", " ").replace("Z", ""),
        "cert_status": ev["cert_status"],
    })
