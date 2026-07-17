"""Crime forecasting / early warning. Builds a monthly series per key
(crime_type or district), fits a least-squares trend (pure Python), forecasts the
next period, and raises an alert when the trend is rising."""
from collections import defaultdict


def monthly_counts(cases, key="crime_type"):
    series = defaultdict(lambda: defaultdict(int))
    for c in cases:
        month = (c.get("incident_date") or "")[:7]  # YYYY-MM
        k = (c.get(key) or "").strip()
        if month and k:
            series[k][month] += 1
    return series


def _slope(points):
    """Least-squares slope of (x, y) points."""
    n = len(points)
    if n < 2:
        return 0.0
    sx = sum(x for x, _ in points)
    sy = sum(y for _, y in points)
    sxx = sum(x * x for x, _ in points)
    sxy = sum(x * y for x, y in points)
    denom = n * sxx - sx * sx
    return (n * sxy - sx * sy) / denom if denom else 0.0


def forecast(cases, key="crime_type", rise_threshold=0.5):
    series = monthly_counts(cases, key)
    out = []
    for k, counts in series.items():
        months = sorted(counts)
        pts = [(i, counts[m]) for i, m in enumerate(months)]
        slope = _slope(pts)
        recent = pts[-1][1] if pts else 0
        out.append({
            "key": k,
            "months_observed": len(months),
            "recent_count": recent,
            "trend_slope": round(slope, 2),
            "forecast_next": max(0, round(recent + slope)),
            "early_warning": slope >= rise_threshold,
        })
    out.sort(key=lambda d: -d["trend_slope"])
    return out
