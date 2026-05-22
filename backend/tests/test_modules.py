"""Backend tests for newly added Barangay modules:
Households, Blotter, Business, Health, Welfare, Appointments, Payments,
Barangay ID, Portal (public + admin), Reports, Photo upload, All 8 document PDFs.
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://barangay-hub-15.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@barangay.gov.ph"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def seeded(auth):
    """Trigger sample data seeder and return a resident_id we can reuse."""
    r = auth.post(f"{BASE_URL}/api/seed/sample-data")
    assert r.status_code == 200, r.text
    rl = auth.get(f"{BASE_URL}/api/residents")
    assert rl.status_code == 200
    residents = rl.json()["residents"]
    assert len(residents) >= 1
    return {"resident_id": residents[0]["id"], "residents": residents}


# ---------- RESIDENTS update + photo (was previously broken) ----------
class TestResidentEditAndPhoto:
    def test_get_resident(self, auth, seeded):
        rid = seeded["resident_id"]
        r = auth.get(f"{BASE_URL}/api/residents/{rid}")
        assert r.status_code == 200, r.text
        assert r.json()["id"] == rid

    def test_update_resident(self, auth, seeded):
        rid = seeded["resident_id"]
        data = auth.get(f"{BASE_URL}/api/residents/{rid}").json()
        payload = {
            "full_name": data["full_name"],
            "address": "Updated Address 123",
            "birthdate": data.get("birthdate", "1990-01-01"),
            "gender": data["gender"],
            "civil_status": data["civil_status"],
            "occupation": "Updated Occ",
            "is_voter": True,
        }
        r = auth.put(f"{BASE_URL}/api/residents/{rid}", json=payload)
        assert r.status_code == 200, r.text
        # verify persisted
        after = auth.get(f"{BASE_URL}/api/residents/{rid}").json()
        assert after["address"] == "Updated Address 123"
        assert after["occupation"] == "Updated Occ"

    def test_photo_upload(self, auth, seeded):
        rid = seeded["resident_id"]
        # minimal 1x1 PNG
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
        )
        s = requests.Session()
        s.cookies = auth.cookies
        files = {"photo": ("test.png", io.BytesIO(png), "image/png")}
        r = s.post(f"{BASE_URL}/api/residents/{rid}/photo", files=files)
        assert r.status_code == 200, r.text
        assert "photo_url" in r.json()


# ---------- HOUSEHOLDS ----------
class TestHouseholds:
    hid = None

    def test_create_household(self, auth, seeded):
        rid = seeded["resident_id"]
        r = auth.post(f"{BASE_URL}/api/households", json={
            "household_head_id": rid,
            "address": "TEST_Household Address",
            "house_number": "H-1",
        })
        assert r.status_code == 200, r.text
        TestHouseholds.hid = r.json()["id"]

    def test_list_households(self, auth):
        r = auth.get(f"{BASE_URL}/api/households")
        assert r.status_code == 200
        assert "households" in r.json()

    def test_household_members(self, auth):
        if not TestHouseholds.hid:
            pytest.skip()
        r = auth.get(f"{BASE_URL}/api/households/{TestHouseholds.hid}/members")
        assert r.status_code == 200

    def test_delete_household(self, auth):
        if not TestHouseholds.hid:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/households/{TestHouseholds.hid}")
        assert r.status_code == 200


# ---------- BLOTTERS ----------
class TestBlotter:
    bid = None

    def test_create(self, auth, seeded):
        r = auth.post(f"{BASE_URL}/api/blotters", json={
            "complainant_id": seeded["resident_id"],
            "respondent_name": "TEST_Suspect",
            "incident_type": "Noise Complaint",
            "incident_date": "2026-01-10",
            "incident_location": "Block 1",
            "description": "Loud party at midnight",
        })
        assert r.status_code == 200, r.text
        TestBlotter.bid = r.json()["id"]
        assert "case_number" in r.json()

    def test_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/blotters")
        assert r.status_code == 200
        assert r.json()["total"] >= 1

    def test_update(self, auth):
        if not TestBlotter.bid:
            pytest.skip()
        r = auth.put(f"{BASE_URL}/api/blotters/{TestBlotter.bid}", json={"status": "resolved"})
        assert r.status_code == 200

    def test_delete(self, auth):
        if not TestBlotter.bid:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/blotters/{TestBlotter.bid}")
        assert r.status_code == 200


# ---------- BUSINESSES ----------
class TestBusiness:
    biz_id = None

    def test_create(self, auth, seeded):
        r = auth.post(f"{BASE_URL}/api/businesses", json={
            "business_name": "TEST_Sari Store",
            "owner_id": seeded["resident_id"],
            "business_type": "Retail",
            "address": "Block 1",
            "capitalization": 10000,
            "employees_count": 1,
        })
        assert r.status_code == 200, r.text
        TestBusiness.biz_id = r.json()["id"]

    def test_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/businesses")
        assert r.status_code == 200

    def test_renew(self, auth):
        if not TestBusiness.biz_id:
            pytest.skip()
        r = auth.put(f"{BASE_URL}/api/businesses/{TestBusiness.biz_id}/renew")
        assert r.status_code == 200
        assert "new_expiry" in r.json()

    def test_delete(self, auth):
        if not TestBusiness.biz_id:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/businesses/{TestBusiness.biz_id}")
        assert r.status_code == 200


# ---------- HEALTH RECORDS ----------
class TestHealth:
    rec_id = None

    def test_create(self, auth, seeded):
        r = auth.post(f"{BASE_URL}/api/health-records", json={
            "resident_id": seeded["resident_id"],
            "record_type": "vaccination",
            "description": "COVID booster",
            "date": "2026-01-05",
        })
        assert r.status_code == 200, r.text
        TestHealth.rec_id = r.json()["id"]

    def test_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/health-records")
        assert r.status_code == 200

    def test_delete(self, auth):
        if not TestHealth.rec_id:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/health-records/{TestHealth.rec_id}")
        assert r.status_code == 200


# ---------- WELFARE ----------
class TestWelfare:
    rec_id = None

    def test_create(self, auth, seeded):
        r = auth.post(f"{BASE_URL}/api/welfare-records", json={
            "resident_id": seeded["resident_id"],
            "program_type": "senior",
            "assistance_type": "Monthly Pension",
            "amount": 500.0,
            "date": "2026-01-15",
        })
        assert r.status_code == 200, r.text
        TestWelfare.rec_id = r.json()["id"]

    def test_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/welfare-records")
        assert r.status_code == 200

    def test_delete(self, auth):
        if not TestWelfare.rec_id:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/welfare-records/{TestWelfare.rec_id}")
        assert r.status_code == 200


# ---------- APPOINTMENTS ----------
class TestAppointments:
    aid = None

    def test_create(self, auth, seeded):
        r = auth.post(f"{BASE_URL}/api/appointments", json={
            "resident_id": seeded["resident_id"],
            "purpose": "Document pickup",
            "appointment_date": "2026-02-01",
            "appointment_time": "10:00",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        TestAppointments.aid = body["id"]
        assert body["queue_number"] >= 1

    def test_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/appointments")
        assert r.status_code == 200

    def test_update_status(self, auth):
        if not TestAppointments.aid:
            pytest.skip()
        # Endpoint expects 'status' as query param
        r = auth.put(f"{BASE_URL}/api/appointments/{TestAppointments.aid}/status",
                     params={"status": "completed"})
        assert r.status_code == 200, r.text

    def test_delete(self, auth):
        if not TestAppointments.aid:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/appointments/{TestAppointments.aid}")
        assert r.status_code == 200


# ---------- PAYMENTS ----------
class TestPayments:
    pid = None

    def test_create(self, auth, seeded):
        r = auth.post(f"{BASE_URL}/api/payments", json={
            "resident_id": seeded["resident_id"],
            "amount": 50.0,
            "payment_for": "document",
            "payment_method": "cash",
        })
        assert r.status_code == 200, r.text
        TestPayments.pid = r.json()["id"]
        assert r.json()["receipt_number"].startswith("OR-")

    def test_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/payments")
        assert r.status_code == 200
        assert "total_revenue" in r.json()

    def test_delete(self, auth):
        if not TestPayments.pid:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/payments/{TestPayments.pid}")
        assert r.status_code == 200


# ---------- BARANGAY ID ----------
class TestBarangayID:
    bid_id = None

    def test_create(self, auth, seeded):
        r = auth.post(f"{BASE_URL}/api/barangay-ids", json={"resident_id": seeded["resident_id"]})
        assert r.status_code == 200, r.text
        TestBarangayID.bid_id = r.json()["id"]

    def test_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/barangay-ids")
        assert r.status_code == 200

    def test_download(self, auth):
        if not TestBarangayID.bid_id:
            pytest.skip()
        r = auth.get(f"{BASE_URL}/api/barangay-ids/{TestBarangayID.bid_id}/download")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500

    def test_delete(self, auth):
        if not TestBarangayID.bid_id:
            pytest.skip()
        r = auth.delete(f"{BASE_URL}/api/barangay-ids/{TestBarangayID.bid_id}")
        assert r.status_code == 200


# ---------- PORTAL (public) ----------
class TestPortal:
    tracking = None
    portal_id = None

    def test_submit_public_request(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/portal/document-request", json={
            "full_name": "TEST_PortalUser",
            "email": "portal_test@example.com",
            "contact_number": "09171112222",
            "address": "Online Submission",
            "document_type": "barangay_clearance",
            "purpose": "Employment",
        })
        assert r.status_code == 200, r.text
        TestPortal.tracking = r.json()["tracking_number"]
        TestPortal.portal_id = r.json()["id"]
        assert TestPortal.tracking.startswith("PT-")

    def test_track_public(self):
        if not TestPortal.tracking:
            pytest.skip()
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/portal/track/{TestPortal.tracking}")
        assert r.status_code == 200, r.text
        assert r.json()["full_name"] == "TEST_PortalUser"

    def test_track_invalid(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/portal/track/PT-NONEXISTENT")
        assert r.status_code == 404

    def test_admin_list_portal_requests(self, auth):
        r = auth.get(f"{BASE_URL}/api/portal-requests")
        assert r.status_code == 200
        items = r.json()["requests"]
        assert any(it.get("tracking_number") == TestPortal.tracking for it in items)

    def test_admin_process(self, auth):
        if not TestPortal.portal_id:
            pytest.skip()
        r = auth.put(f"{BASE_URL}/api/portal-requests/{TestPortal.portal_id}/process")
        assert r.status_code == 200


# ---------- REPORTS ----------
class TestReports:
    def test_residents_report(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/residents")
        assert r.status_code == 200
        data = r.json()
        for k in ["total", "male", "female", "age_groups"]:
            assert k in data

    def test_financial_report(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/financial")
        assert r.status_code == 200
        data = r.json()
        assert "total_revenue" in data and "by_type" in data


# ---------- ALL 8 DOCUMENT PDFs ----------
DOC_TYPES = [
    "barangay_clearance", "certificate_of_residency", "certificate_of_indigency",
    "good_moral_certificate", "first_time_job_seeker", "solo_parent_certificate",
    "cohabitation_certificate", "business_clearance",
]

@pytest.mark.parametrize("doc_type", DOC_TYPES)
def test_document_pdf_generation(auth, seeded, doc_type):
    rid = seeded["resident_id"]
    # create request
    r = auth.post(f"{BASE_URL}/api/document-requests", json={
        "resident_id": rid, "document_type": doc_type, "purpose": "Testing",
    })
    assert r.status_code == 200, r.text
    req_id = r.json()["id"]
    # approve
    a = auth.put(f"{BASE_URL}/api/document-requests/{req_id}/approve")
    assert a.status_code == 200, a.text
    # download
    d = auth.get(f"{BASE_URL}/api/document-requests/{req_id}/download")
    assert d.status_code == 200, f"PDF download failed for {doc_type}: {d.text}"
    assert d.headers.get("content-type", "").startswith("application/pdf")
    assert d.content[:4] == b"%PDF", f"Not a PDF for {doc_type}"
