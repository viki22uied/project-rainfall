"""Measure ER accuracy locally against the real datasets — no deploy needed.
Runs the exact ER logic over data/import/persons.csv and scores predicted matches
against data/import/eval_ground_truth.csv (canonical IDs)."""
import csv
import os
from collections import defaultdict
from er.resolve import resolve
from er.cluster import closure_pairs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def load():
    persons, truth = [], {}
    with open(os.path.join(ROOT, "data", "import", "persons.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            persons.append({"person_id": r["person_id"], "name": r["name_as_recorded"]})
    with open(os.path.join(ROOT, "data", "import", "eval_ground_truth.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["entity_type"] == "person":
                truth[r["biz_id"]] = r["truth_key"]
    return persons, truth


def true_pairs(truth):
    groups = defaultdict(list)
    for pid, cid in truth.items():
        groups[cid].append(pid)
    pairs = set()
    for ids in groups.values():
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                pairs.add(frozenset((ids[i], ids[j])))
    return pairs


def main():
    persons, truth = load()
    gold = true_pairs(truth)
    ranked = resolve(persons, threshold=0)
    cand = {frozenset((m["person_a"], m["person_b"])) for m in ranked}
    blocking_recall = len(cand & gold) / len(gold) if gold else 0
    print(f"persons={len(persons)}  candidate_pairs={len(ranked)}  true_pairs={len(gold)}")
    print(f"blocking recall (true pairs kept as candidates): {blocking_recall:.2f}\n")
    ids = [p["person_id"] for p in persons]
    print("PAIRWISE (candidate matches written as 'pending' for human confirmation):")
    print(f"{'T':>4} {'precision':>10} {'recall':>8} {'F1':>6}   tp fp fn")
    best = (0, -1)
    for T in range(70, 100, 5):
        pred = {frozenset((m["person_a"], m["person_b"])) for m in ranked if m["confidence"] >= T}
        tp = len(pred & gold)
        fp = len(pred - gold)
        fn = len(gold - pred)
        p = tp / (tp + fp) if tp + fp else 0
        r = tp / (tp + fn) if tp + fn else 0
        f1 = 2 * p * r / (p + r) if p + r else 0
        print(f"{T:>4} {p:>10.2f} {r:>8.2f} {f1:>6.2f}   {tp} {fp} {fn}")
        if f1 > best[1]:
            best = (T, f1)
    print(f"\nbest pairwise F1 = {best[1]:.2f} at threshold {best[0]}")

    # After humans confirm the true edges, union-find recovers cross-abbreviated pairs
    # that were never direct candidates — this is the recall ceiling once confirmed.
    confirmed = [(m["person_a"], m["person_b"]) for m in ranked
                 if frozenset((m["person_a"], m["person_b"])) in gold]
    recovered = closure_pairs(ids, confirmed)
    print(f"entity recall after confirmation + closure: {len(recovered & gold) / len(gold):.2f} "
          f"({len(recovered & gold)}/{len(gold)} true pairs)")


if __name__ == "__main__":
    main()
