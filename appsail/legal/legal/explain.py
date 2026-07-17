"""Explainability surfacing (Requirement 14): every AI output ships with its
evidence trail in one standard envelope — the inputs it saw, the method, the
human-readable factors, and the sealed evidence hash it can be cited by."""
from .evidence import seal


def explain(artifact_type, inputs, output, factors, produced_by="Project-Rainfall"):
    """Wrap any AI output with a standard, court-facing explanation + sealed hashes.
    factors: list of {name, detail} justifying the output in plain language."""
    evidence = seal(artifact_type, inputs, output, reasoning_trail=factors, produced_by=produced_by)
    return {
        "artifact_type": artifact_type,
        "output": output,
        "explanation": {
            "inputs_considered": inputs,
            "method": _METHOD.get(artifact_type, "documented deterministic algorithm"),
            "factors": factors,
        },
        "evidence": {
            "output_hash": evidence["output_hash"],
            "generated_at": evidence["generated_at"],
            "cert_status": evidence["cert_status"],
        },
    }


_METHOD = {
    "match": "phonetic/fuzzy name resolution with confidence scoring; human confirms before merge",
    "cluster": "MO-signature similarity with transitive-closure clustering of unsolved cases",
    "risk": "weighted behavioral factors (repeat offending, crime severity, geographic spread)",
    "forecast": "least-squares trend over monthly counts with rising-trend early warning",
}
