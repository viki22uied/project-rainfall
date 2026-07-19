import unittest
from analytics.risk import risk_score
from analytics.forecast import forecast
from analytics.sociodemographic import age_band, urbanization_overlay
from analytics.decision_support import similar_cases, case_summary
from analytics.anomaly import detect_anomalies
from analytics.timeline import build_timeline
from analytics.leads import generate_leads


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


class TestAnomaly(unittest.TestCase):
    def test_spike_month_flagged_normal_months_not(self):
        cases = []
        for month, count in (("2025-01", 2), ("2025-02", 2), ("2025-03", 2),
                              ("2025-04", 2), ("2025-05", 2), ("2025-06", 2), ("2025-07", 20)):
            cases += [{"incident_date": f"{month}-05", "crime_type": "Robbery"}] * count
        out = detect_anomalies(cases, key="crime_type")
        self.assertEqual(out[0]["month"], "2025-07")
        self.assertGreaterEqual(out[0]["z_score"], 2.0)

    def test_flat_series_has_no_anomalies(self):
        cases = []
        for month in ("2025-01", "2025-02", "2025-03"):
            cases += [{"incident_date": f"{month}-05", "crime_type": "Theft"}] * 3
        self.assertEqual(detect_anomalies(cases, key="crime_type"), [])


class TestTimeline(unittest.TestCase):
    def test_events_sorted_chronologically(self):
        case = {"incident_date": "2025-03-01", "crime_type": "Burglary", "district_name": "Ballari"}
        cps = [{"role_in_case": "victim", "person_id": "P1"}]
        audit = [{"ts": "2025-03-02 10:00:00", "action": "mo_clusters", "actor_role": "analyst", "decision": "allowed"}]
        out = build_timeline(case, cps, audit)
        self.assertEqual(out[0]["type"], "fir_filed")
        self.assertEqual(out[-1]["type"], "ai_action")


class TestLeads(unittest.TestCase):
    def test_high_risk_accused_yields_high_priority_lead(self):
        case = {"case_id": "C1", "status": "Unsolved", "crime_type": "Robbery"}
        leads = generate_leads(case, similar=[], accused_risks=[("P1", {"score": 85, "districts": ["A", "B"]})], anomalies=[])
        self.assertEqual(leads[0]["priority"], "high")

    def test_no_signal_falls_back_to_low_priority_default(self):
        case = {"case_id": "C1", "status": "Solved", "crime_type": "Theft"}
        leads = generate_leads(case, similar=[], accused_risks=[], anomalies=[])
        self.assertEqual(leads, [{"priority": "low", "action": "No strong signals — continue standard investigation steps."}])


if __name__ == "__main__":
    unittest.main()
