import unittest
from legal.evidence import seal, verify, bsa63_certificate, artifact_hash
from legal.escalation import fiu_ind_request, natgrid_request
from legal.explain import explain
from legal.export import build_document, encrypt, decrypt, content_hash

INPUTS = {"person_a": "P-1", "person_b": "P-2"}
OUTPUT = {"match": True, "confidence": 96}


class TestEvidence(unittest.TestCase):
    def test_seal_and_verify(self):
        ev = seal("match", INPUTS, OUTPUT, reasoning_trail=[{"name": "name similarity", "detail": "JW 0.96"}])
        self.assertEqual(len(ev["output_hash"]), 64)
        self.assertTrue(verify(ev, INPUTS, OUTPUT))
        self.assertFalse(verify(ev, INPUTS, {"match": False}))  # tamper detected

    def test_hash_is_deterministic_and_order_independent(self):
        self.assertEqual(artifact_hash({"a": 1, "b": 2}), artifact_hash({"b": 2, "a": 1}))

    def test_bsa63_certificate_has_dual_signoff_and_title(self):
        ev = seal("cluster", INPUTS, OUTPUT, reasoning_trail=[])
        cert = bsa63_certificate(ev, {"name": "S. Gowda", "designation": "Deputy SP"},
                                 {"name": "A. Kulkarni", "designation": "Forensic Analyst"})
        self.assertIn("Section 63", cert["title"])
        self.assertEqual(len(cert["chain_of_custody"]), 2)
        self.assertEqual(cert["status"], "draft_pending_dual_signoff")


class TestEscalation(unittest.TestCase):
    def test_rank_gating(self):
        sp = {"name": "X", "rank": "SP", "email": "sp@demo"}
        si = {"name": "Y", "rank": "Sub-Inspector", "email": "si@demo"}
        self.assertEqual(natgrid_request({"person_id": "P-1"}, sp)["status"], "request_generated")
        self.assertEqual(natgrid_request({"person_id": "P-1"}, si)["status"], "refused")
        self.assertTrue(fiu_ind_request({"case_id": "C-1"}, {"name": "Z", "rank": "Deputy SP"})["simulated"])

    def test_never_returns_live_data(self):
        r = fiu_ind_request({"case_id": "C-1"}, {"name": "Z", "rank": "SP"})
        self.assertTrue(r["simulated"])
        self.assertNotIn("transactions", r)  # a request object, never live results


class TestExplain(unittest.TestCase):
    def test_envelope_has_method_factors_and_hash(self):
        e = explain("risk", {"cases": 4}, {"score": 89},
                    factors=[{"name": "repeat_offending", "detail": "4 cases"}])
        self.assertIn("method", e["explanation"])
        self.assertEqual(len(e["evidence"]["output_hash"]), 64)


class TestExport(unittest.TestCase):
    def test_encrypt_roundtrip_and_tamper(self):
        doc = build_document([{"role": "user", "text": "who is accused in C-5001?"},
                              {"role": "assistant", "text": "P-1001 (masked)"}],
                             meta={"actor": "analyst@rainfall.demo"})
        blob = encrypt(doc, "s3cret")
        self.assertEqual(decrypt(blob, "s3cret"), doc)
        with self.assertRaises(ValueError):
            decrypt(blob, "wrong-password")
        self.assertEqual(blob["content_hash"], content_hash(doc))


if __name__ == "__main__":
    unittest.main()
