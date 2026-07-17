import unittest
from mo.similarity import similarity, shared_features
from mo.cluster import cluster_cases

A = {"case_id": "C1", "crime_type": "Chain Snatching", "entry_method": "distraction",
     "weapon": "none", "target_type": "gold chain", "time_band": "Evening", "district_name": "Ballari"}
B = {"case_id": "C2", "crime_type": "Chain Snatching", "entry_method": "distraction",
     "weapon": "none", "target_type": "gold chain", "time_band": "Evening", "district_name": "Belagavi"}
C = {"case_id": "C3", "crime_type": "Burglary", "entry_method": "wall scaled",
     "weapon": "blunt", "target_type": "house", "time_band": "Night", "district_name": "Mysuru"}


class TestSimilarity(unittest.TestCase):
    def test_identical_mo_scores_one(self):
        self.assertEqual(similarity(A, B), 1.0)
        self.assertEqual(len(shared_features(A, B)), 5)

    def test_different_mo_scores_zero(self):
        self.assertEqual(similarity(A, C), 0.0)


class TestCluster(unittest.TestCase):
    def test_clusters_matching_mo_flags_cross_jurisdiction(self):
        clusters = cluster_cases([A, B, C], threshold=1.0)
        self.assertEqual(len(clusters), 1)              # C fell out (different MO)
        self.assertEqual(sorted(clusters[0]["case_ids"]), ["C1", "C2"])
        self.assertTrue(clusters[0]["cross_jurisdiction"])  # Ballari + Belagavi

    def test_singletons_are_not_clusters(self):
        self.assertEqual(cluster_cases([C], threshold=1.0), [])


if __name__ == "__main__":
    unittest.main()
