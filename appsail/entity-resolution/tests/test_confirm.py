import unittest
from unittest.mock import patch
import catalyst_io


class FakeZcql:
    """Mimics zcatalyst_sdk's query result shape: rows nested under the table name."""
    def __init__(self, entity_matches, case_persons):
        self.entity_matches = entity_matches
        self.case_persons = case_persons

    def execute_query(self, q):
        if q.startswith("SELECT ROWID FROM EntityMatches"):
            # naive WHERE emulation: find rows whose pair appears anywhere in the query text
            matches = [r for r in self.entity_matches if r["person_a"] in q and r["person_b"] in q]
            return [{"EntityMatches": {"ROWID": r["ROWID"]}} for r in matches[:1]]
        if q.startswith("SELECT case_id, role_in_case FROM CasePersons"):
            pid = q.split("person_id = '")[1].split("'")[0]
            rows = [r for r in self.case_persons if r["person_id"] == pid]
            return [{"CasePersons": {"case_id": r["case_id"], "role_in_case": r["role_in_case"]}} for r in rows]
        raise AssertionError(f"unexpected query: {q}")


class FakeTable:
    def __init__(self, name, store):
        self.name = name
        self.store = store

    def insert_row(self, row):
        row = dict(row)
        row["ROWID"] = f"R{len(self.store[self.name]) + 1}"
        self.store[self.name].append(row)
        return row

    def update_row(self, row):
        for r in self.store[self.name]:
            if r["ROWID"] == row["ROWID"]:
                r.update(row)
        return row


class FakeDatastore:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return FakeTable(name, self.store)


class FakeClient:
    def __init__(self, entity_matches, case_persons):
        self.store = {"EntityMatches": entity_matches, "CasePersons": case_persons}
        self._zcql = FakeZcql(entity_matches, case_persons)

    def zcql(self):
        return self._zcql

    def datastore(self):
        return FakeDatastore(self.store)


def make_client(case_persons, entity_matches=None):
    return FakeClient(entity_matches or [], case_persons)


class TestConfirmMatch(unittest.TestCase):
    def _case_persons(self):
        return [
            {"case_id": "C-1", "person_id": "P-A", "role_in_case": "accused"},
            {"case_id": "C-2", "person_id": "P-A", "role_in_case": "accused"},
            {"case_id": "C-3", "person_id": "P-B", "role_in_case": "witness"},
        ]

    def test_confirm_links_cases_both_ways_and_skips_existing(self):
        cp = self._case_persons()
        cp.append({"case_id": "C-3", "person_id": "P-A", "role_in_case": "witness"})  # already linked
        client = make_client(cp)
        with patch.object(catalyst_io, "_client", return_value=client):
            result = catalyst_io.confirm_match("P-A", "P-B", "confirmed", "sup@x.com", 97, "composite")

        # P-B gets C-1, C-2 (2 new); P-A already has C-3 so no new row for that side.
        self.assertEqual(result["links_created"], 2)
        new_rows = [r for r in client.store["CasePersons"] if r.get("link_source") == "er_inferred"]
        self.assertEqual(len(new_rows), 2)
        self.assertTrue(all(r["match_ref"] == result["match_ref"] for r in new_rows))
        self.assertTrue(all(r["link_confidence"] == 97 for r in new_rows))
        b_case_ids = {r["case_id"] for r in new_rows if r["person_id"] == "P-B"}
        self.assertEqual(b_case_ids, {"C-1", "C-2"})

    def test_reject_updates_status_but_creates_no_links(self):
        client = make_client(self._case_persons())
        with patch.object(catalyst_io, "_client", return_value=client):
            result = catalyst_io.confirm_match("P-A", "P-B", "rejected", "sup@x.com", 80, "composite")
        self.assertEqual(result["links_created"], 0)
        self.assertEqual(result["status"], "rejected")
        self.assertFalse(any(r.get("link_source") == "er_inferred" for r in client.store["CasePersons"]))

    def test_confirm_reuses_existing_pending_match_row(self):
        pending = [{"ROWID": "EM1", "person_a": "P-A", "person_b": "P-B", "status": "pending"}]
        client = make_client(self._case_persons(), entity_matches=pending)
        with patch.object(catalyst_io, "_client", return_value=client):
            result = catalyst_io.confirm_match("P-A", "P-B", "confirmed", "sup@x.com", 90, "composite")
        self.assertEqual(result["match_ref"], "EM1")
        # updated in place, not a second row inserted
        self.assertEqual(len(client.store["EntityMatches"]), 1)
        self.assertEqual(client.store["EntityMatches"][0]["status"], "confirmed")

    def test_same_person_rejected(self):
        client = make_client([])
        with patch.object(catalyst_io, "_client", return_value=client):
            with self.assertRaises(ValueError):
                catalyst_io.confirm_match("P-A", "P-A", "confirmed", "sup@x.com", 90, "composite")


if __name__ == "__main__":
    unittest.main()
