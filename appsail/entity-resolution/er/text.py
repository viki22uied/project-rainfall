"""Text helpers for entity resolution. Works on name_as_recorded (raw), since the
DB's name_normalized has spaces stripped and loses token boundaries we need."""
import re
import jellyfish


def normalize(name):
    """Lowercase, letters only, no spaces — collapses 'Girish Shetty' / 'GirishShetty'."""
    return re.sub(r"[^a-z]", "", (name or "").lower())


def tokens(name):
    """Word tokens, lowercased. 'V. Reddy' -> ['v', 'reddy']."""
    return [t for t in re.split(r"[^a-z]+", (name or "").lower()) if t]


def phonetic(s):
    return jellyfish.metaphone(s) if s else ""
