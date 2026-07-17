import unittest
from er.blocking import candidate_pairs
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
    def test_all_pairs_generated(self):
        persons = [("P1", "Girish Shetty"), ("P2", "GirishShetty"), ("P3", "Prakash Kumar")]
        pairs = candidate_pairs(persons)
        self.assertEqual(len(pairs), 3)  # C(3,2)
        self.assertIn(frozenset(("P1", "P2")), pairs)
        self.assertNotIn(frozenset(("P1", "P1")), pairs)


if __name__ == "__main__":
    unittest.main()
