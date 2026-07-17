"""Measure MO clustering accuracy locally against the real data.
Clusters unsolved cases by MO signature and scores predicted links against the
hidden serial-cluster ground truth (data/import/eval_ground_truth.csv)."""
import csv
import os
from collections import defaultdict
from mo.cluster import cluster_cases

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def load():
    cases, truth = [], {}
    with open(os.path.join(ROOT, "data", "import", "cases.csv"), encoding="utf-8") as f:
        cases = list(csv.DictReader(f))
    with open(os.path.join(ROOT, "data", "import", "eval_ground_truth.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["entity_type"] == "case":
                truth[r["biz_id"]] = r["truth_key"]
    return cases, truth


def pairs_within(groups):
    pairs = set()
    for members in groups.values():
        m = list(members)
        for i in range(len(m)):
            for j in range(i + 1, len(m)):
                pairs.add(frozenset((m[i], m[j])))
    return pairs


def main():
    cases, truth = load()
    # Product use case: link UNSOLVED cases (no named suspect).
    unsolved = [c for c in cases if c.get("status") == "Unsolved"]

    gold_groups = defaultdict(list)
    for cid, serial in truth.items():
        if serial:  # only real serial clusters, noise cases have empty truth
            gold_groups[serial].append(cid)
    gold = pairs_within(gold_groups)

    print(f"cases={len(cases)} unsolved={len(unsolved)} serial_clusters={len(gold_groups)} "
          f"gold_pairs={len(gold)}")
    print(f"{'thr':>4} {'clusters':>9} {'precision':>10} {'recall':>8} {'F1':>6}  tp fp fn")
    for thr in (1.0, 0.8):
        clusters = cluster_cases(unsolved, threshold=thr)
        pred_groups = {i: c["case_ids"] for i, c in enumerate(clusters)}
        pred = pairs_within(pred_groups)
        tp = len(pred & gold)
        fp = len(pred - gold)
        fn = len(gold - pred)
        p = tp / (tp + fp) if tp + fp else 0
        r = tp / (tp + fn) if tp + fn else 0
        f1 = 2 * p * r / (p + r) if p + r else 0
        print(f"{thr:>4} {len(clusters):>9} {p:>10.2f} {r:>8.2f} {f1:>6.2f}  {tp} {fp} {fn}")

    print("\nserial patterns found (threshold=1.0):")
    for c in cluster_cases(unsolved, threshold=1.0):
        print(f"  {c['size']} cases across {len(c['districts'])} districts "
              f"(cross-jurisdiction={c['cross_jurisdiction']}, score={c['score']}): {c['case_ids']}")


if __name__ == "__main__":
    main()
