"""MO Clustering AppSail service.

  GET  /health     liveness
  POST /cluster    cluster unsolved Cases by MO signature, write MoClusters
  GET  /evaluate   cluster + score against held-out serial-cluster ground truth
"""
import os
from collections import defaultdict
from flask import Flask, jsonify, request

from mo.cluster import cluster_cases
import catalyst_io

app = Flask(__name__)
DEFAULT_THRESHOLD = float(os.environ.get("MO_THRESHOLD", "1.0"))


@app.route("/health")
def health():
    return jsonify(status="ok")


@app.route("/cluster", methods=["POST"])
def do_cluster():
    threshold = float(request.args.get("threshold", DEFAULT_THRESHOLD))
    cases = catalyst_io.load_unsolved_cases()
    clusters = cluster_cases(cases, threshold)
    written = catalyst_io.write_clusters(clusters)
    return jsonify(unsolved=len(cases), clusters=len(clusters), written=written,
                   threshold=threshold, patterns=clusters)


def _pairs(groups):
    pairs = set()
    for members in groups:
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                pairs.add(frozenset((members[i], members[j])))
    return pairs


@app.route("/evaluate")
def do_evaluate():
    threshold = float(request.args.get("threshold", DEFAULT_THRESHOLD))
    cases = catalyst_io.load_unsolved_cases()
    truth = catalyst_io.load_truth()
    gold_groups = defaultdict(list)
    for cid, serial in truth.items():
        if serial:
            gold_groups[serial].append(cid)
    gold = _pairs(gold_groups.values())
    clusters = cluster_cases(cases, threshold)
    pred = _pairs([c["case_ids"] for c in clusters])
    tp, fp, fn = len(pred & gold), len(pred - gold), len(gold - pred)
    p = tp / (tp + fp) if tp + fp else 0
    r = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * p * r / (p + r) if p + r else 0
    return jsonify(threshold=threshold, unsolved=len(cases), clusters=len(clusters),
                   precision=round(p, 3), recall=round(r, 3), f1=round(f1, 3),
                   tp=tp, fp=fp, fn=fn)


if __name__ == "__main__":
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", "9000"))
    app.run(host="0.0.0.0", port=port)
