"""Orchestrate: blocking -> scoring -> ranked candidate matches.
No silent auto-merge (PRD): callers write these as `pending` for human confirmation."""
from .blocking import candidate_pairs
from .scoring import score_pair


def resolve(persons, threshold=0):
    """persons: list of {'person_id', 'name'}. Returns matches sorted by confidence desc."""
    name_by = {p["person_id"]: p["name"] for p in persons}
    plist = [(p["person_id"], p["name"]) for p in persons]
    matches = []
    for pair in candidate_pairs(plist):
        a, b = tuple(pair)
        score = score_pair(name_by[a], name_by[b])
        if score >= threshold:
            matches.append({"person_a": a, "person_b": b, "confidence": score, "method": "composite"})
    matches.sort(key=lambda m: -m["confidence"])
    return matches
