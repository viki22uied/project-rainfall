"""Anomaly detection: flags months where a key's case count deviates sharply
(z-score >= threshold) from its own monthly baseline. Reuses forecast's
monthly_counts — no new data pipeline."""
from .forecast import monthly_counts


def detect_anomalies(cases, key="crime_type", z_threshold=2.0):
    series = monthly_counts(cases, key)
    out = []
    for k, counts in series.items():
        vals = list(counts.values())
        n = len(vals)
        if n < 3:
            continue
        mean = sum(vals) / n
        var = sum((v - mean) ** 2 for v in vals) / n
        std = var ** 0.5
        if std == 0:
            continue
        for month, v in sorted(counts.items()):
            z = (v - mean) / std
            if z >= z_threshold:
                out.append({"key": k, "month": month, "count": v,
                            "z_score": round(z, 2), "baseline_mean": round(mean, 2)})
    out.sort(key=lambda d: -d["z_score"])
    return out
