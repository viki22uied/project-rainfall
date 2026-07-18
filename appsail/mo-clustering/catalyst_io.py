"""Catalyst Data Store access (admin scope): read unsolved Cases, write MoClusters,
read held-out case ground truth for /evaluate."""
import json
from datetime import datetime, timezone


def _client():
    import zcatalyst_sdk
    from flask import request
    return zcatalyst_sdk.initialize(req=request)


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def load_unsolved_cases():
    rows = _client().zcql().execute_query(
        "SELECT case_id, crime_type, entry_method, weapon, target_type, time_band, "
        "district_name, status FROM Cases WHERE status = 'Unsolved'")
    return [r["Cases"] for r in rows]


def load_truth():
    rows = _client().zcql().execute_query(
        "SELECT biz_id, truth_key FROM EvalGroundTruth WHERE entity_type = 'case'")
    return {r["EvalGroundTruth"]["biz_id"]: r["EvalGroundTruth"]["truth_key"] for r in rows}


def write_clusters(clusters):
    table = _client().datastore().table("MoClusters")
    written = 0
    for i, c in enumerate(clusters, 1):
        table.insert_row({
            "cluster_label": f"SERIAL-CAND-{i}",
            "signature": json.dumps({"districts": c["districts"],
                                     "cross_jurisdiction": c["cross_jurisdiction"]}),
            "case_ids": json.dumps(c["case_ids"]),
            "score": c["score"],
            "created_at": _now(),
        })
        written += 1
    return written
