"""A case's Modus Operandi signature: the behavioral fingerprint an offender
leaves, independent of identity. Deliberately excludes district — cross-
jurisdiction spread is the *signal* of a serial offender, not a difference."""

MO_FEATURES = ("crime_type", "entry_method", "weapon", "target_type", "time_band")


def signature(case):
    return {f: (case.get(f) or "").strip() for f in MO_FEATURES}
