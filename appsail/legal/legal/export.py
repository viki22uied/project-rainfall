"""Encrypted conversation export (Requirement 4). Builds a transcript, stamps a
content hash (chain-of-custody / tamper-evidence), and encrypts it under a password.

ponytail: scrypt KDF + HMAC-SHA256 counter-mode keystream, stdlib-only so it always
runs. Swap for AES-256-GCM (`cryptography`) in production; the interface is stable.
PDF rendering of the decrypted transcript is done client-side."""
import hashlib
import hmac
import os
from datetime import datetime, timezone


def build_document(conversation, meta=None):
    """conversation: list of {role, text}. Returns a plain-text transcript."""
    meta = meta or {}
    lines = ["PROJECT-RAINFALL — CONVERSATION EXPORT",
             f"exported_at: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}"]
    lines += [f"{k}: {v}" for k, v in meta.items()]
    lines.append("-" * 48)
    lines += [f"[{t.get('role', '?')}] {t.get('text', '')}" for t in conversation]
    return "\n".join(lines)


def content_hash(document):
    return hashlib.sha256(document.encode("utf-8")).hexdigest()


def _keystream(key, n):
    out = bytearray()
    counter = 0
    while len(out) < n:
        out += hmac.new(key, counter.to_bytes(8, "big"), hashlib.sha256).digest()
        counter += 1
    return bytes(out[:n])


def _derive(password, salt):
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, dklen=32)


def encrypt(document, password):
    salt = os.urandom(16)
    key = _derive(password, salt)
    data = document.encode("utf-8")
    ct = bytes(a ^ b for a, b in zip(data, _keystream(key, len(data))))
    return {
        "salt": salt.hex(),
        "ciphertext": ct.hex(),
        "tag": hmac.new(key, ct, hashlib.sha256).hexdigest(),
        "content_hash": content_hash(document),
        "kdf": "scrypt", "cipher": "hmac-sha256-ctr(demo)",
    }


def decrypt(blob, password):
    key = _derive(password, bytes.fromhex(blob["salt"]))
    ct = bytes.fromhex(blob["ciphertext"])
    if not hmac.compare_digest(hmac.new(key, ct, hashlib.sha256).hexdigest(), blob["tag"]):
        raise ValueError("integrity check failed (wrong password or tampered data)")
    return bytes(a ^ b for a, b in zip(ct, _keystream(key, len(ct)))).decode("utf-8")
