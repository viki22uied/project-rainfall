"""Pair similarity -> confidence 0..100. Name-only on purpose: father_name,
approx_age and district are noisy for the same person in this data."""
from .text import normalize, tokens
from .jarowinkler import jaro_winkler


def _tok_sim(s, l):
    # an initial matches a full token that starts with it ('v' ~ 'venkatesh')
    if len(s) == 1:
        return 1.0 if l.startswith(s) else 0.0
    if len(l) == 1:
        return 1.0 if s.startswith(l) else 0.0
    return jaro_winkler(s, l)


def _token_align(a, b):
    """Greedy best-match of tokens, order-insensitive, penalizing extra tokens."""
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    small, large = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    used = [False] * len(large)
    total = 0.0
    for s in small:
        best, bi = 0.0, -1
        for i, l in enumerate(large):
            if used[i]:
                continue
            sim = _tok_sim(s, l)
            if sim > best:
                best, bi = sim, i
        if bi >= 0:
            used[bi] = True
            total += best
    return total / len(large)  # dividing by the larger count penalizes unmatched tokens


def score_pair(a, b):
    na, nb = normalize(a), normalize(b)
    whole = jaro_winkler(na, nb) if na and nb else 0.0
    align = _token_align(a, b)
    return round(max(whole, align) * 100)
