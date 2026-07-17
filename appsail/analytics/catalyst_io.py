"""Read Cases, CasePersons, Persons, Districts (admin scope) for the analytics."""


def _zcql(q):
    import zcatalyst_sdk
    from flask import request
    return zcatalyst_sdk.initialize(req=request).zcql().execute_zcql_query(q)


def load_cases():
    return [r["Cases"] for r in _zcql(
        "SELECT case_id, crime_type, entry_method, weapon, target_type, time_band, "
        "district_name, status, incident_date FROM Cases")]


def load_case_persons():
    return [r["CasePersons"] for r in _zcql(
        "SELECT case_id, person_id, role_in_case FROM CasePersons")]


def load_persons():
    return [r["Persons"] for r in _zcql("SELECT person_id, approx_age FROM Persons")]


def load_districts():
    return [r["Districts"] for r in _zcql("SELECT district_name, total_cases FROM Districts")]
