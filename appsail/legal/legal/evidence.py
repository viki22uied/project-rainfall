"""Court-admissible AI evidence chain (differentiator 3.3).

Every AI output (a match, a cluster, a risk score) is hash-stamped at the moment
of generation, and a Bharatiya Sakshya Adhiniyam 2023 Section 63 electronic-
evidence certificate is auto-drafted. Without this, an AI output is a suggestion;
with it, it is admissible evidence."""
import hashlib
import json
from datetime import datetime, timezone


def _canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def artifact_hash(obj):
    return hashlib.sha256(_canonical(obj).encode("utf-8")).hexdigest()


def seal(artifact_type, inputs, output, reasoning_trail, produced_by="Project-Rainfall"):
    """Hash-stamp an AI output at generation time. artifact_type: match|cluster|risk|forecast."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "artifact_type": artifact_type,
        "input_hash": artifact_hash(inputs),
        "output_hash": artifact_hash(output),
        "reasoning_trail": reasoning_trail,
        "produced_by": produced_by,
        "generated_at": ts,
        "cert_status": "sealed",
    }


def verify(evidence, inputs, output):
    """Re-hash the claimed inputs/output and confirm they match the sealed hashes."""
    return (artifact_hash(inputs) == evidence["input_hash"]
            and artifact_hash(output) == evidence["output_hash"])


def bsa63_certificate(evidence, custodian, expert):
    """Auto-draft the Section 63 certificate. Dual sign-off (custodian + expert) is
    what the statute requires for the electronic record to be admissible."""
    return {
        "title": "Certificate under Section 63, Bharatiya Sakshya Adhiniyam, 2023",
        "electronic_record": {
            "artifact_type": evidence["artifact_type"],
            "output_hash_sha256": evidence["output_hash"],
            "input_hash_sha256": evidence["input_hash"],
            "generated_at": evidence["generated_at"],
            "produced_by_system": evidence["produced_by"],
        },
        "manner_of_production": (
            "Produced by the Project-Rainfall automated crime-intelligence system from the "
            "stated inputs in the ordinary course of its operation; integrity secured by a "
            "SHA-256 hash computed at the time of generation."),
        "reasoning_trail": evidence["reasoning_trail"],
        "chain_of_custody": [
            {"role": "custodian", "name": custodian.get("name"),
             "designation": custodian.get("designation"), "signed": False},
            {"role": "expert", "name": expert.get("name"),
             "designation": expert.get("designation"), "signed": False},
        ],
        "declaration": (
            "The contents of this certificate are true to the best of my knowledge and belief, "
            "and the computer output was produced by the computer in the ordinary course of activities."),
        "status": "draft_pending_dual_signoff",
    }
