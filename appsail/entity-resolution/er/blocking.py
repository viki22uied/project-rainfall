"""Candidate generation. Two block-key strategies, unioned, so we catch every
variant type without an O(n^2) all-pairs comparison:

  W: whole-name phonetic (space-stripped) -> catches spacing/concatenation/case
     ('Girish Shetty' vs 'GirishShetty')
  T: per-token phonetic                   -> catches initials/partial/reorder
     ('V. Reddy' vs 'VENKATESH REDDY' share token 'reddy';
      'Manjunath I.' vs 'MANJUNATH IYER' share token 'manjunath')
"""
from collections import defaultdict
from .text import normalize, tokens, phonetic


def block_keys(name):
    keys = set()
    whole = normalize(name)
    if whole:
        keys.add("W:" + phonetic(whole))
    for t in tokens(name):
        if len(t) > 1:  # skip single-letter initials — they'd over-block
            keys.add("T:" + phonetic(t))
    return keys


def candidate_pairs(persons):
    """persons: list of (person_id, name). Returns a set of frozenset({idA, idB})
    for every pair that shares at least one block key."""
    buckets = defaultdict(list)
    for pid, name in persons:
        for k in block_keys(name):
            buckets[k].append(pid)
    pairs = set()
    for ids in buckets.values():
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                if ids[i] != ids[j]:
                    pairs.add(frozenset((ids[i], ids[j])))
    return pairs
