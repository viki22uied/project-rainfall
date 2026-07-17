"""Precision/recall/F1 over match pairs — shared by the local eval and /evaluate."""
from collections import defaultdict


def true_pairs(truth):
    """truth: {person_id: canonical_id} -> set of frozenset pairs sharing a canonical id."""
    groups = defaultdict(list)
    for pid, cid in truth.items():
        groups[cid].append(pid)
    pairs = set()
    for ids in groups.values():
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                pairs.add(frozenset((ids[i], ids[j])))
    return pairs


def prf1(pred, gold):
    tp = len(pred & gold)
    fp = len(pred - gold)
    fn = len(gold - pred)
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(f1, 3),
            "tp": tp, "fp": fp, "fn": fn}
