"""Backend API tests for Barangay Management System."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://barangay-hub-15.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@barangay.gov.ph"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_session(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return session


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "super_admin"
        # httpOnly cookies
        assert "access_token" in r.cookies or any(c.name == "access_token" for c in session.cookies)

    def test_login_invalid(self, session):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "x@x.com", "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_stats(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ["total_residents", "total_households", "pending_requests"]:
            assert k in data


# ---------- RESIDENTS ----------
class TestResidents:
    created_id = None

    def test_create_resident(self, auth_session):
        payload = {
            "full_name": "TEST_Juan Dela Cruz",
            "address": "Purok 1, Barangay Test",
            "birthdate": "1990-05-15",
            "gender": "Male",
            "civil_status": "Single",
            "is_voter": True,
        }
        r = auth_session.post(f"{BASE_URL}/api/residents", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["full_name"] == payload["full_name"]
        assert "id" in data
        assert data["age"] > 0
        TestResidents.created_id = data["id"]

    def test_get_residents_list(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/residents")
        assert r.status_code == 200
        data = r.json()
        assert "residents" in data and "total" in data
        assert any(res.get("full_name", "").startswith("TEST_") for res in data["residents"])

    def test_search_residents(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/residents", params={"search": "TEST_Juan"})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1

    def test_get_resident_by_id(self, auth_session):
        # Bug: residents stored with _id but get/update/delete uses 'id' field
        if not TestResidents.created_id:
            pytest.skip("No resident created")
        r = auth_session.get(f"{BASE_URL}/api/residents/{TestResidents.created_id}")
        # Expecting 200 ideally - this may fail due to id field mismatch
        assert r.status_code == 200, f"GET by id failed: {r.status_code} - residents may not store 'id' field"

    def test_delete_resident(self, auth_session):
        if not TestResidents.created_id:
            pytest.skip("No resident created")
        r = auth_session.delete(f"{BASE_URL}/api/residents/{TestResidents.created_id}")
        assert r.status_code == 200, f"Delete failed: {r.text}"


# ---------- DOCUMENTS ----------
class TestDocuments:
    resident_id = None
    request_id = None

    def test_create_resident_for_doc(self, auth_session):
        payload = {
            "full_name": "TEST_DocPerson",
            "address": "Test Addr",
            "birthdate": "1985-01-01",
            "gender": "Female",
            "civil_status": "Married",
        }
        r = auth_session.post(f"{BASE_URL}/api/residents", json=payload)
        assert r.status_code == 200
        TestDocuments.resident_id = r.json()["id"]

    def test_create_document_request(self, auth_session):
        if not TestDocuments.resident_id:
            pytest.skip("No resident")
        payload = {
            "resident_id": TestDocuments.resident_id,
            "document_type": "barangay_clearance",
            "purpose": "Employment",
        }
        r = auth_session.post(f"{BASE_URL}/api/document-requests", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        TestDocuments.request_id = data["id"]

    def test_list_document_requests(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/document-requests")
        assert r.status_code == 200
        assert "requests" in r.json()

    def test_approve_document(self, auth_session):
        if not TestDocuments.request_id:
            pytest.skip()
        r = auth_session.put(f"{BASE_URL}/api/document-requests/{TestDocuments.request_id}/approve")
        assert r.status_code == 200, r.text

    def test_download_document_pdf(self, auth_session):
        if not TestDocuments.request_id:
            pytest.skip()
        r = auth_session.get(f"{BASE_URL}/api/document-requests/{TestDocuments.request_id}/download")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 100

    def test_cleanup_resident(self, auth_session):
        if TestDocuments.resident_id:
            auth_session.delete(f"{BASE_URL}/api/residents/{TestDocuments.resident_id}")


# ---------- LOGOUT ----------
class TestLogout:
    def test_logout(self, auth_session):
        r = auth_session.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
