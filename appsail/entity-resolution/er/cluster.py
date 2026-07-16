"""Transitive closure of match edges into entity clusters (union-find).
If A~B and B~C are confident matches, A and C are the same entity even when the
direct A~C pair was never a candidate (cross-abbreviated names like
'M. Iyer' / 'Meena I.' both link through 'Meena Iyer')."""
from collections import defaultdict


def clusters(ids, edges):
    parent = {i: i for i in ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in edges:
        if a in parent and b in parent:
            parent[find(a)] = find(b)

    groups = defaultdict(list)
    for i in ids:
        groups[find(i)].append(i)
    return list(groups.values())


def closure_pairs(ids, edges):
    """All within-cluster pairs after closing over `edges`."""
    pairs = set()
    for group in clusters(ids, edges):
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                pairs.add(frozenset((group[i], group[j])))
    return pairs
