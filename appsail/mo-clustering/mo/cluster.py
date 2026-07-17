"""Cluster cases into likely serial-offender groups by MO similarity.
Union-find: two cases link when their signatures match at/above `threshold`;
connected components with >1 member are candidate serial patterns."""
from collections import defaultdict
from .similarity import similarity


def cluster_cases(cases, threshold=1.0):
    """cases: list of dicts (case_id + MO features). Returns list of dicts:
    {case_ids, size, districts, score} — one per multi-case cluster."""
    ids = [c["case_id"] for c in cases]
    by_id = {c["case_id"]: c for c in cases}
    parent = {i: i for i in ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    strengths = defaultdict(list)  # component-root -> list of edge similarities
    for i in range(len(cases)):
        for j in range(i + 1, len(cases)):
            s = similarity(cases[i], cases[j])
            if s >= threshold:
                a, b = cases[i]["case_id"], cases[j]["case_id"]
                parent[find(a)] = find(b)

    # second pass to accumulate edge strengths within final components
    for i in range(len(cases)):
        for j in range(i + 1, len(cases)):
            s = similarity(cases[i], cases[j])
            if s >= threshold:
                strengths[find(cases[i]["case_id"])].append(s)

    groups = defaultdict(list)
    for i in ids:
        groups[find(i)].append(i)

    clusters = []
    for root, members in groups.items():
        if len(members) < 2:
            continue
        members = sorted(members)
        districts = sorted({(by_id[m].get("district_name") or "").strip() for m in members if by_id[m].get("district_name")})
        edge_sims = strengths.get(root, [])
        score = round(100 * (sum(edge_sims) / len(edge_sims)) if edge_sims else 0)
        clusters.append({
            "case_ids": members,
            "size": len(members),
            "districts": districts,
            "cross_jurisdiction": len(districts) > 1,
            "score": score,
        })
    clusters.sort(key=lambda c: (-c["size"], -c["score"]))
    return clusters
