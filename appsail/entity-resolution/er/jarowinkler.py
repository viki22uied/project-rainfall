"""Pure-Python Jaro-Winkler similarity (0..1). No dependencies."""


def _jaro(s1, s2):
    if s1 == s2:
        return 1.0
    l1, l2 = len(s1), len(s2)
    if l1 == 0 or l2 == 0:
        return 0.0
    reach = max(max(l1, l2) // 2 - 1, 0)
    m1 = [False] * l1
    m2 = [False] * l2
    matches = 0
    for i in range(l1):
        for j in range(max(0, i - reach), min(i + reach + 1, l2)):
            if not m2[j] and s1[i] == s2[j]:
                m1[i] = m2[j] = True
                matches += 1
                break
    if matches == 0:
        return 0.0
    transpositions = 0
    k = 0
    for i in range(l1):
        if not m1[i]:
            continue
        while not m2[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1
    t = transpositions / 2
    return (matches / l1 + matches / l2 + (matches - t) / matches) / 3


def jaro_winkler(s1, s2, prefix_weight=0.1):
    j = _jaro(s1, s2)
    prefix = 0
    for a, b in zip(s1, s2):
        if a != b:
            break
        prefix += 1
        if prefix == 4:
            break
    return j + prefix * prefix_weight * (1 - j)
