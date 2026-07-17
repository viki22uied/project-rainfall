"""Pairwise MO similarity = fraction of behavioral features that match (0..1).
No named suspect required — this links cases purely on behavior."""
from .signature import MO_FEATURES, signature


def similarity(a, b):
    sa, sb = signature(a), signature(b)
    matches = sum(1 for f in MO_FEATURES if sa[f] and sa[f] == sb[f])
    return matches / len(MO_FEATURES)


def shared_features(a, b):
    sa, sb = signature(a), signature(b)
    return [f for f in MO_FEATURES if sa[f] and sa[f] == sb[f]]
