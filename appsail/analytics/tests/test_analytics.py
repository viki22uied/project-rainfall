import unittest
from analytics.risk import risk_score
from analytics.forecast import forecast
from analytics.sociodemographic import age_band, urbanization_overlay
from analytics.decision_support import similar_cases, case_summary


class TestRisk(unittest.TestCase):
    def test_repeat_cross_district_violent_scores_higher_than_single_minor(self):
        high = risk_score([
            {"crime_type": "Robbery", "district_name": "Ballari"},
            {"crime_type": "Assault", "district_name": "Mysuru City"},
            {"crime_type": "Robbery", "district_name": "Tumakuru"},
        ])
        low = risk_score([{"crime_type": "Theft", "district_name": "Ballari"}])
        self.assertGreater(high["score"], low["score"])
        self.assertIn("repeat_offending", high["factors"])   # explainable
        self.assertEqual(risk_score([])["score"], 0)


class TestForecast(unittest.TestCase):
    def test_rising_series_raises_early_warning(self):
        cases = []
        for month, count in (("2025-01", 1), ("2025-02", 3), ("2025-03", 6)):
            cases += [{"incident_date": f"{month}-05", "crime_type": "Burglary"}] * count
        out = forecast(cases, key="crime_type")
        self.assertTrue(out[0]["early_warning"])
        self.assertGreaterEqual(out[0]["forecast_next"], 6)


class TestSocioDemographic(unittest.TestCase):
    def test_age_band(self):
        self.assertEqual(age_band("22"), "18-24")
        self.assertEqual(age_band("60"), "55+")
        self.assertEqual(age_band("x"), "unknown")

    def test_urbanization_tiers_by_intensity(self):
        d = urbanization_overlay([
            {"district_name": "A", "total_cases": "100"},
            {"district_name": "B", "total_cases": "50"},
            {"district_name": "C", "total_cases": "10"},
        ])
        self.assertEqual(d[0]["tier"], "high")
        self.assertEqual(d[-1]["tier"], "low")


class TestDecisionSupport(unittest.TestCase):
    def test_similar_cases_ranks_shared_mo_first(self):
        target = {"case_id": "T", "crime_type": "Chain Snatching", "entry_method": "distraction",
                  "weapon": "none", "target_type": "gold chain", "time_band": "Evening"}
        twin = dict(target, case_id="X")
        other = {"case_id": "Y", "crime_type": "Burglary", "entry_method": "wall",
                 "weapon": "blunt", "target_type": "house", "time_band": "Night"}
        out = similar_cases(target, [twin, other])
        self.assertEqual(out[0]["case_id"], "X")
        self.assertEqual(out[0]["similarity"], 100)
        self.assertIn("100%", case_summary(target, out))


if __name__ == "__main__":
    unittest.main()
