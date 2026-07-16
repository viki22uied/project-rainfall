import unittest
from er.blocking import block_keys, candidate_pairs
from er.scoring import score_pair


class TestScoring(unittest.TestCase):
    def test_variant_types_score_high(self):
        # the four variant patterns the PRD names
        self.assertGreaterEqual(score_pair("Girish Shetty", "GirishShetty"), 95)   # spacing/concat
        self.assertGreaterEqual(score_pair("MANJUNATH IYER", "Manjunath I."), 90)  # ALLCAPS + initial
        self.assertGreaterEqual(score_pair("VENKATESH REDDY", "V. Reddy"), 90)     # initial + case
        self.assertGreaterEqual(score_pair("Radha Iyer", "RadhaIyer"), 95)         # concat

    def test_different_people_score_low(self):
        self.assertLess(score_pair("Prakash Kumar", "Nagaraj Shetty"), 60)
        self.assertLess(score_pair("Girish Shetty", "Girish Kumar"), 90)  # shared first name only


class TestBlocking(unittest.TestCase):
    def test_whole_name_key_groups_concatenation(self):
        self.assertTrue(block_keys("Girish Shetty") & block_keys("GirishShetty"))

    def test_token_key_groups_initial_and_full(self):
        self.assertTrue(block_keys("V. Reddy") & block_keys("VENKATESH REDDY"))
        self.assertTrue(block_keys("Manjunath I.") & block_keys("MANJUNATH IYER"))

    def test_candidate_pairs_finds_known_variants(self):
        persons = [
            ("P1", "Girish Shetty"), ("P2", "GirishShetty"),
            ("P3", "Prakash Kumar"),
        ]
        pairs = candidate_pairs(persons)
        self.assertIn(frozenset(("P1", "P2")), pairs)
        self.assertNotIn(frozenset(("P1", "P3")), pairs)


if __name__ == "__main__":
    unittest.main()
