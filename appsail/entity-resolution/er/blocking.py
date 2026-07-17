"""Candidate generation. With ~10^2 persons, all-pairs is trivial and imposes no
recall ceiling (phonetic blocking was dropping ~24% of true pairs before they
could even be scored).

ponytail: all-pairs O(n^2). Add phonetic/LSH blocking here if the person count
grows past a few thousand — the rest of the pipeline is agnostic to how pairs
are generated."""


def candidate_pairs(persons):
    """persons: list of (person_id, name). Returns every unordered id pair."""
    pairs = set()
    ids = [pid for pid, _ in persons]
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            pairs.add(frozenset((ids[i], ids[j])))
    return pairs
