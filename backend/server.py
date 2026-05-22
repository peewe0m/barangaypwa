from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Query, Form
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import secrets
import io

from utils.auth_helpers import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, get_current_user
)
from utils.pdf_generator import (
    generate_barangay_clearance, generate_certificate_of_residency,
    generate_certificate_of_indigency, generate_good_moral,
    generate_first_time_job_seeker, generate_solo_parent,
    generate_cohabitation, generate_business_clearance_pdf,
    generate_barangay_id, generate_qr_code
)
from config.system import SYSTEM_CONFIG

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "residents").mkdir(exist_ok=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Mount uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ============ MODELS ============

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "staff"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ResidentCreate(BaseModel):
    full_name: str
    address: str
    birthdate: str
    gender: str
    civil_status: str
    citizenship: str = "Filipino"
    contact_number: Optional[str] = None
    occupation: Optional[str] = None
    email: Optional[EmailStr] = None
    religion: Optional[str] = None
    is_voter: bool = False
    is_pwd: bool = False
    is_senior: bool = False
    is_solo_parent: bool = False
    emergency_contact: Optional[str] = None
    household_id: Optional[str] = None

class HouseholdCreate(BaseModel):
    household_head_id: str
    address: str
    house_number: Optional[str] = None
    notes: Optional[str] = None

class DocumentRequestCreate(BaseModel):
    resident_id: str
    document_type: str
    purpose: str
    additional_details: Optional[dict] = {}

class BlotterCreate(BaseModel):
    complainant_id: str
    respondent_name: str
    incident_type: str
    incident_date: str
    incident_location: str
    description: str
    status: str = "pending"

class BlotterUpdate(BaseModel):
    status: Optional[str] = None
    resolution: Optional[str] = None
    mediation_date: Optional[str] = None

class BusinessCreate(BaseModel):
    business_name: str
    owner_id: str
    business_type: str
    address: str
    contact_number: Optional[str] = None
    capitalization: Optional[float] = 0.0
    employees_count: Optional[int] = 0

class HealthRecordCreate(BaseModel):
    resident_id: str
    record_type: str  # vaccination, medical, prenatal
    description: str
    date: str
    notes: Optional[str] = None
    medication: Optional[str] = None

class WelfareRecordCreate(BaseModel):
    resident_id: str
    program_type: str  # senior, pwd, solo_parent, 4ps
    assistance_type: str
    amount: float = 0.0
    description: Optional[str] = None
    date: str

class AppointmentCreate(BaseModel):
    resident_id: str
    purpose: str
    appointment_date: str
    appointment_time: str
    notes: Optional[str] = None

class PaymentCreate(BaseModel):
    document_request_id: Optional[str] = None
    resident_id: Optional[str] = None
    amount: float
    payment_for: str = "document"
    payment_method: str = "cash"

class BarangayIDCreate(BaseModel):
    resident_id: str

class PortalRequestCreate(BaseModel):
    full_name: str
    email: EmailStr
    contact_number: str
    address: str
    document_type: str
    purpose: str

# ============ STARTUP ============

@app.on_event("startup")
async def startup_event():
    await db.users.create_index("email", unique=True)
    await db.residents.create_index("full_name")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    logger.info("Database indexes created")

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@barangay.gov.ph")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email, "password_hash": hashed,
            "full_name": "System Administrator", "role": "super_admin",
            "created_at": datetime.now(timezone.utc)
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    credentials_content = f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: super_admin

## API Endpoints
- Login: POST /api/auth/login
- Get Current User: GET /api/auth/me
"""
    Path("/app/memory").mkdir(exist_ok=True)
    Path("/app/memory/test_credentials.md").write_text(credentials_content)

def calculate_age(birthdate_str: str) -> int:
    try:
        birthdate = datetime.fromisoformat(birthdate_str.split('T')[0])
        today = datetime.now()
        return today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))
    except ValueError:
        return 0

def generate_document_number(doc_type: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    prefix = doc_type[:3].upper()
    return f"{prefix}-{timestamp}-{secrets.token_hex(2).upper()}"

def serialize_doc(doc: dict) -> dict:
    """Convert datetime fields to ISO strings"""
    if not doc:
        return doc
    for key, val in list(doc.items()):
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    doc.pop("_id", None)
    return doc

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(user_data.password)
    user_doc = {
        "email": email, "password_hash": hashed,
        "full_name": user_data.full_name, "role": user_data.role,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": email, "full_name": user_data.full_name, "role": user_data.role}

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    email = credentials.email.lower()
    attempt_doc = await db.login_attempts.find_one({"identifier": email})
    if attempt_doc and attempt_doc.get("attempts", 0) >= 5:
        locked_until = attempt_doc.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < locked_until:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        if attempt_doc:
            new_attempts = attempt_doc.get("attempts", 0) + 1
            locked_until = datetime.now(timezone.utc) + timedelta(minutes=15) if new_attempts >= 5 else None
            await db.login_attempts.update_one({"identifier": email}, {"$set": {"attempts": new_attempts, "locked_until": locked_until}})
        else:
            await db.login_attempts.insert_one({"identifier": email, "attempts": 1, "locked_until": None})
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.login_attempts.delete_one({"identifier": email})
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": user["email"], "full_name": user["full_name"], "role": user["role"]}

@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request, db)

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

# ============ RESIDENTS ============

@api_router.post("/residents")
async def create_resident(resident: ResidentCreate, request: Request):
    user = await get_current_user(request, db)
    resident_doc = resident.model_dump()
    resident_doc["id"] = secrets.token_urlsafe(16)
    resident_doc["age"] = calculate_age(resident.birthdate)
    resident_doc["photo_url"] = None
    resident_doc["created_at"] = datetime.now(timezone.utc)
    resident_doc["created_by"] = user["_id"]
    await db.residents.insert_one(resident_doc)
    return serialize_doc(resident_doc)

@api_router.get("/residents")
async def get_residents(request: Request, skip: int = 0, limit: int = 100, search: Optional[str] = None):
    await get_current_user(request, db)
    query = {}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}}
        ]
    total = await db.residents.count_documents(query)
    residents = await db.residents.find(query, {"_id": 0, "created_by": 0}).skip(skip).limit(limit).to_list(length=limit)
    for r in residents:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return {"total": total, "residents": residents}

@api_router.get("/residents/{resident_id}")
async def get_resident(resident_id: str, request: Request):
    await get_current_user(request, db)
    resident = await db.residents.find_one({"id": resident_id}, {"_id": 0, "created_by": 0})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    if isinstance(resident.get("created_at"), datetime):
        resident["created_at"] = resident["created_at"].isoformat()
    return resident

@api_router.put("/residents/{resident_id}")
async def update_resident(resident_id: str, resident_update: ResidentCreate, request: Request):
    await get_current_user(request, db)
    update_data = resident_update.model_dump()
    update_data["age"] = calculate_age(resident_update.birthdate)
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.residents.update_one({"id": resident_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resident not found")
    return {"message": "Resident updated successfully"}

@api_router.delete("/residents/{resident_id}")
async def delete_resident(resident_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.residents.delete_one({"id": resident_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resident not found")
    return {"message": "Resident deleted successfully"}

@api_router.post("/residents/{resident_id}/photo")
async def upload_resident_photo(resident_id: str, request: Request, photo: UploadFile = File(...)):
    await get_current_user(request, db)
    resident = await db.residents.find_one({"id": resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    ext = Path(photo.filename).suffix or ".jpg"
    filename = f"{resident_id}{ext}"
    filepath = UPLOADS_DIR / "residents" / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(photo.file, f)
    photo_url = f"/uploads/residents/{filename}"
    await db.residents.update_one({"id": resident_id}, {"$set": {"photo_url": photo_url}})
    return {"photo_url": photo_url}

# ============ HOUSEHOLDS ============

@api_router.post("/households")
async def create_household(household: HouseholdCreate, request: Request):
    await get_current_user(request, db)
    head = await db.residents.find_one({"id": household.household_head_id})
    if not head:
        raise HTTPException(status_code=404, detail="Household head not found")
    household_doc = household.model_dump()
    household_doc["id"] = secrets.token_urlsafe(16)
    household_doc["household_head_name"] = head["full_name"]
    household_doc["created_at"] = datetime.now(timezone.utc)
    await db.households.insert_one(household_doc)
    # Update head's household_id
    await db.residents.update_one({"id": household.household_head_id}, {"$set": {"household_id": household_doc["id"]}})
    return serialize_doc(household_doc)

@api_router.get("/households")
async def get_households(request: Request):
    await get_current_user(request, db)
    households = await db.households.find({}, {"_id": 0}).to_list(length=200)
    for h in households:
        if isinstance(h.get("created_at"), datetime):
            h["created_at"] = h["created_at"].isoformat()
        # Count members
        h["member_count"] = await db.residents.count_documents({"household_id": h["id"]})
    return {"households": households, "total": len(households)}

@api_router.get("/households/{household_id}/members")
async def get_household_members(household_id: str, request: Request):
    await get_current_user(request, db)
    members = await db.residents.find({"household_id": household_id}, {"_id": 0, "created_by": 0}).to_list(length=100)
    for m in members:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    return {"members": members}

@api_router.put("/households/{household_id}/add-member/{resident_id}")
async def add_household_member(household_id: str, resident_id: str, request: Request):
    await get_current_user(request, db)
    await db.residents.update_one({"id": resident_id}, {"$set": {"household_id": household_id}})
    return {"message": "Member added to household"}

@api_router.delete("/households/{household_id}")
async def delete_household(household_id: str, request: Request):
    await get_current_user(request, db)
    await db.residents.update_many({"household_id": household_id}, {"$set": {"household_id": None}})
    result = await db.households.delete_one({"id": household_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Household not found")
    return {"message": "Household deleted"}

# ============ DOCUMENT REQUESTS ============

@api_router.post("/document-requests")
async def create_document_request(doc_request: DocumentRequestCreate, request: Request):
    user = await get_current_user(request, db)
    resident = await db.residents.find_one({"id": doc_request.resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    request_doc = {
        "id": secrets.token_urlsafe(16),
        "resident_id": doc_request.resident_id,
        "document_type": doc_request.document_type,
        "purpose": doc_request.purpose,
        "status": "pending",
        "document_number": generate_document_number(doc_request.document_type),
        "additional_details": doc_request.additional_details,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"]
    }
    await db.document_requests.insert_one(request_doc)
    request_doc.pop("created_by", None)
    return serialize_doc(request_doc)

@api_router.get("/document-requests")
async def get_document_requests(request: Request):
    await get_current_user(request, db)
    requests = await db.document_requests.find({}, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(length=200)
    for r in requests:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
        if isinstance(r.get("issue_date"), datetime):
            r["issue_date"] = r["issue_date"].isoformat()
    return {"total": len(requests), "requests": requests}

@api_router.put("/document-requests/{request_id}/approve")
async def approve_document(request_id: str, request: Request):
    user = await get_current_user(request, db)
    result = await db.document_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "issue_date": datetime.now(timezone.utc), "approved_by": user["_id"]}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document request not found")
    return {"message": "Approved"}

@api_router.put("/document-requests/{request_id}/reject")
async def reject_document(request_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.document_requests.update_one({"id": request_id}, {"$set": {"status": "rejected"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document request not found")
    return {"message": "Rejected"}

@api_router.get("/document-requests/{request_id}/download")
async def download_document(request_id: str, request: Request):
    await get_current_user(request, db)
    doc_request = await db.document_requests.find_one({"id": request_id})
    if not doc_request:
        raise HTTPException(status_code=404, detail="Document request not found")
    if doc_request["status"] != "approved":
        raise HTTPException(status_code=400, detail="Document not yet approved")
    resident = await db.residents.find_one({"id": doc_request["resident_id"]}, {"_id": 0})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    request_data = {
        "document_number": doc_request["document_number"],
        "issue_date": doc_request["issue_date"].isoformat() if isinstance(doc_request.get("issue_date"), datetime) else datetime.now(timezone.utc).isoformat(),
        "purpose": doc_request["purpose"],
    }
    generators = {
        "barangay_clearance": generate_barangay_clearance,
        "certificate_of_residency": generate_certificate_of_residency,
        "certificate_of_indigency": generate_certificate_of_indigency,
        "good_moral_certificate": generate_good_moral,
        "first_time_job_seeker": generate_first_time_job_seeker,
        "solo_parent_certificate": generate_solo_parent,
        "cohabitation_certificate": generate_cohabitation,
        "business_clearance": generate_business_clearance_pdf,
    }
    gen = generators.get(doc_request["document_type"])
    if not gen:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    pdf_bytes = gen(resident, request_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={doc_request['document_type']}_{doc_request['document_number']}.pdf"}
    )

# ============ BUSINESS CLEARANCE ============

@api_router.post("/businesses")
async def create_business(business: BusinessCreate, request: Request):
    user = await get_current_user(request, db)
    owner = await db.residents.find_one({"id": business.owner_id})
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    business_doc = business.model_dump()
    business_doc["id"] = secrets.token_urlsafe(16)
    business_doc["owner_name"] = owner["full_name"]
    business_doc["permit_number"] = f"BP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    business_doc["status"] = "active"
    business_doc["registered_date"] = datetime.now(timezone.utc)
    business_doc["expiry_date"] = datetime.now(timezone.utc) + timedelta(days=365)
    business_doc["created_at"] = datetime.now(timezone.utc)
    business_doc["created_by"] = user["_id"]
    await db.businesses.insert_one(business_doc)
    business_doc.pop("created_by", None)
    return serialize_doc(business_doc)

@api_router.get("/businesses")
async def get_businesses(request: Request):
    await get_current_user(request, db)
    businesses = await db.businesses.find({}, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(length=200)
    for b in businesses:
        for key in ["registered_date", "expiry_date", "created_at"]:
            if isinstance(b.get(key), datetime):
                b[key] = b[key].isoformat()
    return {"businesses": businesses, "total": len(businesses)}

@api_router.put("/businesses/{business_id}/renew")
async def renew_business(business_id: str, request: Request):
    await get_current_user(request, db)
    new_expiry = datetime.now(timezone.utc) + timedelta(days=365)
    result = await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"expiry_date": new_expiry, "status": "active", "renewed_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"message": "Business permit renewed", "new_expiry": new_expiry.isoformat()}

@api_router.delete("/businesses/{business_id}")
async def delete_business(business_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.businesses.delete_one({"id": business_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"message": "Business deleted"}

# ============ BLOTTER ============

@api_router.post("/blotters")
async def create_blotter(blotter: BlotterCreate, request: Request):
    user = await get_current_user(request, db)
    blotter_doc = blotter.model_dump()
    blotter_doc["id"] = secrets.token_urlsafe(16)
    blotter_doc["case_number"] = f"BL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    blotter_doc["created_at"] = datetime.now(timezone.utc)
    blotter_doc["created_by"] = user["_id"]
    complainant = await db.residents.find_one({"id": blotter.complainant_id})
    if complainant:
        blotter_doc["complainant_name"] = complainant["full_name"]
    await db.blotters.insert_one(blotter_doc)
    blotter_doc.pop("created_by", None)
    return serialize_doc(blotter_doc)

@api_router.get("/blotters")
async def get_blotters(request: Request):
    await get_current_user(request, db)
    blotters = await db.blotters.find({}, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(length=200)
    for b in blotters:
        if isinstance(b.get("created_at"), datetime):
            b["created_at"] = b["created_at"].isoformat()
    return {"blotters": blotters, "total": len(blotters)}

@api_router.put("/blotters/{blotter_id}")
async def update_blotter(blotter_id: str, update: BlotterUpdate, request: Request):
    await get_current_user(request, db)
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.blotters.update_one({"id": blotter_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Blotter not found")
    return {"message": "Blotter updated"}

@api_router.delete("/blotters/{blotter_id}")
async def delete_blotter(blotter_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.blotters.delete_one({"id": blotter_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blotter not found")
    return {"message": "Blotter deleted"}

# ============ HEALTH RECORDS ============

@api_router.post("/health-records")
async def create_health_record(record: HealthRecordCreate, request: Request):
    user = await get_current_user(request, db)
    resident = await db.residents.find_one({"id": record.resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    record_doc = record.model_dump()
    record_doc["id"] = secrets.token_urlsafe(16)
    record_doc["resident_name"] = resident["full_name"]
    record_doc["created_at"] = datetime.now(timezone.utc)
    record_doc["created_by"] = user["_id"]
    await db.health_records.insert_one(record_doc)
    record_doc.pop("created_by", None)
    return serialize_doc(record_doc)

@api_router.get("/health-records")
async def get_health_records(request: Request, record_type: Optional[str] = None):
    await get_current_user(request, db)
    query = {"record_type": record_type} if record_type else {}
    records = await db.health_records.find(query, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(length=200)
    for r in records:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return {"records": records, "total": len(records)}

@api_router.delete("/health-records/{record_id}")
async def delete_health_record(record_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.health_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Deleted"}

# ============ WELFARE ============

@api_router.post("/welfare-records")
async def create_welfare(record: WelfareRecordCreate, request: Request):
    user = await get_current_user(request, db)
    resident = await db.residents.find_one({"id": record.resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    record_doc = record.model_dump()
    record_doc["id"] = secrets.token_urlsafe(16)
    record_doc["resident_name"] = resident["full_name"]
    record_doc["created_at"] = datetime.now(timezone.utc)
    record_doc["created_by"] = user["_id"]
    await db.welfare_records.insert_one(record_doc)
    record_doc.pop("created_by", None)
    return serialize_doc(record_doc)

@api_router.get("/welfare-records")
async def get_welfare(request: Request, program_type: Optional[str] = None):
    await get_current_user(request, db)
    query = {"program_type": program_type} if program_type else {}
    records = await db.welfare_records.find(query, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(length=200)
    for r in records:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return {"records": records, "total": len(records)}

@api_router.delete("/welfare-records/{record_id}")
async def delete_welfare(record_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.welfare_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Deleted"}

# ============ APPOINTMENTS ============

@api_router.post("/appointments")
async def create_appointment(appt: AppointmentCreate, request: Request):
    user = await get_current_user(request, db)
    resident = await db.residents.find_one({"id": appt.resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    appt_doc = appt.model_dump()
    appt_doc["id"] = secrets.token_urlsafe(16)
    appt_doc["resident_name"] = resident["full_name"]
    appt_doc["status"] = "scheduled"
    appt_doc["queue_number"] = await db.appointments.count_documents({"appointment_date": appt.appointment_date}) + 1
    appt_doc["created_at"] = datetime.now(timezone.utc)
    appt_doc["created_by"] = user["_id"]
    await db.appointments.insert_one(appt_doc)
    appt_doc.pop("created_by", None)
    return serialize_doc(appt_doc)

@api_router.get("/appointments")
async def get_appointments(request: Request, date: Optional[str] = None):
    await get_current_user(request, db)
    query = {"appointment_date": date} if date else {}
    appointments = await db.appointments.find(query, {"_id": 0, "created_by": 0}).sort("appointment_date", -1).to_list(length=200)
    for a in appointments:
        if isinstance(a.get("created_at"), datetime):
            a["created_at"] = a["created_at"].isoformat()
    return {"appointments": appointments, "total": len(appointments)}

@api_router.put("/appointments/{appt_id}/status")
async def update_appointment_status(appt_id: str, status: str, request: Request):
    await get_current_user(request, db)
    result = await db.appointments.update_one({"id": appt_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Updated"}

@api_router.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.appointments.delete_one({"id": appt_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Deleted"}

# ============ PAYMENTS ============

@api_router.post("/payments")
async def create_payment(payment: PaymentCreate, request: Request):
    user = await get_current_user(request, db)
    payment_doc = payment.model_dump()
    payment_doc["id"] = secrets.token_urlsafe(16)
    payment_doc["receipt_number"] = f"OR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    payment_doc["status"] = "completed"
    payment_doc["created_at"] = datetime.now(timezone.utc)
    payment_doc["processed_by"] = user["_id"]
    if payment.resident_id:
        resident = await db.residents.find_one({"id": payment.resident_id})
        if resident:
            payment_doc["resident_name"] = resident["full_name"]
    await db.payments.insert_one(payment_doc)
    payment_doc.pop("processed_by", None)
    return serialize_doc(payment_doc)

@api_router.get("/payments")
async def get_payments(request: Request):
    await get_current_user(request, db)
    payments = await db.payments.find({}, {"_id": 0, "processed_by": 0}).sort("created_at", -1).to_list(length=200)
    for p in payments:
        if isinstance(p.get("created_at"), datetime):
            p["created_at"] = p["created_at"].isoformat()
    # Calculate totals
    total_revenue = sum(p.get("amount", 0) for p in payments)
    return {"payments": payments, "total": len(payments), "total_revenue": total_revenue}

@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, request: Request):
    await get_current_user(request, db)
    result = await db.payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Deleted"}

# ============ BARANGAY ID ============

@api_router.post("/barangay-ids")
async def create_barangay_id(data: BarangayIDCreate, request: Request):
    user = await get_current_user(request, db)
    resident = await db.residents.find_one({"id": data.resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    existing = await db.barangay_ids.find_one({"resident_id": data.resident_id, "status": "active"})
    if existing:
        return serialize_doc(existing)
    id_doc = {
        "id": secrets.token_urlsafe(16),
        "resident_id": data.resident_id,
        "resident_name": resident["full_name"],
        "id_number": f"BID-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "issue_date": datetime.now(timezone.utc),
        "expiry_date": datetime.now(timezone.utc) + timedelta(days=1825),  # 5 years
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"]
    }
    await db.barangay_ids.insert_one(id_doc)
    id_doc.pop("created_by", None)
    return serialize_doc(id_doc)

@api_router.get("/barangay-ids")
async def get_barangay_ids(request: Request):
    await get_current_user(request, db)
    ids = await db.barangay_ids.find({}, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(length=200)
    for i in ids:
        for key in ["issue_date", "expiry_date", "created_at"]:
            if isinstance(i.get(key), datetime):
                i[key] = i[key].isoformat()
    return {"ids": ids, "total": len(ids)}

@api_router.get("/barangay-ids/{id}/download")
async def download_barangay_id(id: str, request: Request):
    await get_current_user(request, db)
    id_doc = await db.barangay_ids.find_one({"id": id})
    if not id_doc:
        raise HTTPException(status_code=404, detail="ID not found")
    resident = await db.residents.find_one({"id": id_doc["resident_id"]}, {"_id": 0})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    photo_bytes = None
    if resident.get("photo_url"):
        photo_path = ROOT_DIR / resident["photo_url"].lstrip("/")
        if photo_path.exists():
            with open(photo_path, "rb") as f:
                photo_bytes = f.read()
    pdf_bytes = generate_barangay_id(resident, id_doc, photo_bytes)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=barangay_id_{id_doc['id_number']}.pdf"}
    )

@api_router.delete("/barangay-ids/{id}")
async def delete_barangay_id(id: str, request: Request):
    await get_current_user(request, db)
    result = await db.barangay_ids.delete_one({"id": id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="ID not found")
    return {"message": "Deleted"}

# ============ DASHBOARD STATS ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    await get_current_user(request, db)
    total_residents = await db.residents.count_documents({})
    total_households = await db.households.count_documents({})
    total_pwd = await db.residents.count_documents({"is_pwd": True})
    total_senior = await db.residents.count_documents({"is_senior": True})
    total_solo_parent = await db.residents.count_documents({"is_solo_parent": True})
    total_voters = await db.residents.count_documents({"is_voter": True})
    total_businesses = await db.businesses.count_documents({})
    total_blotters = await db.blotters.count_documents({})

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_transactions = await db.document_requests.count_documents({"created_at": {"$gte": today}})
    pending_requests = await db.document_requests.count_documents({"status": "pending"})
    approved_requests = await db.document_requests.count_documents({"status": "approved"})

    # Monthly revenue
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_payments = await db.payments.find({"created_at": {"$gte": month_start}}).to_list(length=1000)
    monthly_revenue = sum(p.get("amount", 0) for p in monthly_payments)

    recent_activity = await db.document_requests.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(length=10)
    for activity in recent_activity:
        if isinstance(activity.get("created_at"), datetime):
            activity["created_at"] = activity["created_at"].isoformat()

    return {
        "total_residents": total_residents,
        "total_households": total_households,
        "total_pwd": total_pwd,
        "total_senior": total_senior,
        "total_solo_parent": total_solo_parent,
        "total_voters": total_voters,
        "total_businesses": total_businesses,
        "total_blotters": total_blotters,
        "today_transactions": today_transactions,
        "pending_requests": pending_requests,
        "approved_requests": approved_requests,
        "monthly_revenue": monthly_revenue,
        "recent_activity": recent_activity
    }

# ============ REPORTS ============

@api_router.get("/reports/residents")
async def report_residents(request: Request):
    await get_current_user(request, db)
    residents = await db.residents.find({}, {"_id": 0, "created_by": 0}).to_list(length=1000)
    male_count = sum(1 for r in residents if r.get("gender") == "Male")
    female_count = sum(1 for r in residents if r.get("gender") == "Female")
    age_groups = {"0-17": 0, "18-35": 0, "36-59": 0, "60+": 0}
    for r in residents:
        age = r.get("age", 0)
        if age < 18:
            age_groups["0-17"] += 1
        elif age < 36:
            age_groups["18-35"] += 1
        elif age < 60:
            age_groups["36-59"] += 1
        else:
            age_groups["60+"] += 1
    return {
        "total": len(residents),
        "male": male_count, "female": female_count,
        "age_groups": age_groups,
        "voters": sum(1 for r in residents if r.get("is_voter")),
        "pwd": sum(1 for r in residents if r.get("is_pwd")),
        "senior": sum(1 for r in residents if r.get("is_senior")),
        "solo_parent": sum(1 for r in residents if r.get("is_solo_parent")),
    }

@api_router.get("/reports/financial")
async def report_financial(request: Request):
    await get_current_user(request, db)
    payments = await db.payments.find({}, {"_id": 0, "processed_by": 0}).to_list(length=2000)
    total = sum(p.get("amount", 0) for p in payments)
    by_type = {}
    for p in payments:
        pt = p.get("payment_for", "other")
        by_type[pt] = by_type.get(pt, 0) + p.get("amount", 0)
    return {"total_revenue": total, "transaction_count": len(payments), "by_type": by_type}

# ============ RESIDENT PORTAL (Public) ============

@api_router.post("/portal/document-request")
async def portal_request(req: PortalRequestCreate):
    """Public endpoint for residents to request documents online"""
    portal_doc = {
        "id": secrets.token_urlsafe(16),
        "tracking_number": f"PT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "full_name": req.full_name,
        "email": req.email,
        "contact_number": req.contact_number,
        "address": req.address,
        "document_type": req.document_type,
        "purpose": req.purpose,
        "status": "submitted",
        "source": "online_portal",
        "created_at": datetime.now(timezone.utc)
    }
    await db.portal_requests.insert_one(portal_doc)
    return serialize_doc(portal_doc)

@api_router.get("/portal/track/{tracking_number}")
async def track_request(tracking_number: str):
    """Public endpoint for tracking request status"""
    req = await db.portal_requests.find_one({"tracking_number": tracking_number}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if isinstance(req.get("created_at"), datetime):
        req["created_at"] = req["created_at"].isoformat()
    return req

@api_router.get("/portal-requests")
async def get_portal_requests(request: Request):
    """Admin endpoint to see portal requests"""
    await get_current_user(request, db)
    requests = await db.portal_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    for r in requests:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return {"requests": requests, "total": len(requests)}

@api_router.put("/portal-requests/{req_id}/process")
async def process_portal_request(req_id: str, request: Request):
    """Convert portal request to actual document request"""
    user = await get_current_user(request, db)
    portal_req = await db.portal_requests.find_one({"id": req_id})
    if not portal_req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.portal_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "processed", "processed_at": datetime.now(timezone.utc), "processed_by": user["_id"]}}
    )
    return {"message": "Request processed"}

# ============ CONFIG ============

@api_router.get("/config/system")
async def get_system_config():
    return SYSTEM_CONFIG

# ============ SEED ============

@api_router.post("/seed/sample-data")
async def seed_sample_data(request: Request):
    user = await get_current_user(request, db)
    await db.residents.delete_many({"id": {"$exists": False}})
    existing_count = await db.residents.count_documents({})
    if existing_count >= 10:
        return {"message": "Sample data already seeded", "residents_count": existing_count}

    sample_residents = [
        {"full_name": "Juan Dela Cruz", "address": "Block 1 Lot 2, San Miguel St.", "birthdate": "1985-03-15", "gender": "Male", "civil_status": "Married", "occupation": "Engineer", "contact_number": "09171234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": False},
        {"full_name": "Maria Santos", "address": "Block 2 Lot 5, Rizal Ave.", "birthdate": "1990-07-22", "gender": "Female", "civil_status": "Single", "occupation": "Teacher", "contact_number": "09181234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": False},
        {"full_name": "Pedro Reyes", "address": "Block 3 Lot 8, Bonifacio St.", "birthdate": "1955-11-10", "gender": "Male", "civil_status": "Widowed", "occupation": "Retired", "contact_number": "09191234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": True, "is_solo_parent": False},
        {"full_name": "Ana Garcia", "address": "Block 4 Lot 11, Mabini St.", "birthdate": "1988-04-18", "gender": "Female", "civil_status": "Separated", "occupation": "Nurse", "contact_number": "09201234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": True},
        {"full_name": "Carlos Mendoza", "address": "Block 5 Lot 14, Aguinaldo St.", "birthdate": "1972-09-05", "gender": "Male", "civil_status": "Married", "occupation": "Driver", "contact_number": "09211234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": True, "is_senior": False, "is_solo_parent": False},
        {"full_name": "Rosa Fernandez", "address": "Block 6 Lot 17, Luna St.", "birthdate": "1950-12-25", "gender": "Female", "civil_status": "Widowed", "occupation": "Retired", "contact_number": "09221234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": True, "is_solo_parent": False},
        {"full_name": "Miguel Torres", "address": "Block 7 Lot 20, Quezon Ave.", "birthdate": "1995-06-30", "gender": "Male", "civil_status": "Single", "occupation": "Programmer", "contact_number": "09231234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": False},
        {"full_name": "Luz Aquino", "address": "Block 8 Lot 23, Magsaysay St.", "birthdate": "1982-02-14", "gender": "Female", "civil_status": "Married", "occupation": "Accountant", "contact_number": "09241234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": False},
        {"full_name": "Roberto Castro", "address": "Block 9 Lot 26, Roxas St.", "birthdate": "1968-08-19", "gender": "Male", "civil_status": "Married", "occupation": "Mechanic", "contact_number": "09251234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": False},
        {"full_name": "Sofia Ramos", "address": "Block 10 Lot 29, Marcos Highway", "birthdate": "1958-05-08", "gender": "Female", "civil_status": "Married", "occupation": "Housewife", "contact_number": "09261234567", "religion": "Iglesia ni Cristo", "is_voter": True, "is_pwd": False, "is_senior": True, "is_solo_parent": False},
        {"full_name": "Antonio Bautista", "address": "Block 11 Lot 32, Bonifacio Drive", "birthdate": "1993-01-20", "gender": "Male", "civil_status": "Single", "occupation": "Electrician", "contact_number": "09271234567", "religion": "Born Again Christian", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": False},
        {"full_name": "Elena Villanueva", "address": "Block 12 Lot 35, Lapu-Lapu St.", "birthdate": "1986-10-12", "gender": "Female", "civil_status": "Married", "occupation": "Doctor", "contact_number": "09281234567", "religion": "Roman Catholic", "is_voter": True, "is_pwd": False, "is_senior": False, "is_solo_parent": False},
    ]

    inserted_residents = []
    for resident_data in sample_residents:
        resident_doc = {
            **resident_data, "id": secrets.token_urlsafe(16),
            "age": calculate_age(resident_data["birthdate"]),
            "citizenship": "Filipino", "email": None, "emergency_contact": None,
            "household_id": None, "photo_url": None,
            "created_at": datetime.now(timezone.utc), "created_by": user["_id"]
        }
        await db.residents.insert_one(resident_doc)
        inserted_residents.append(resident_doc["id"])

    # Documents
    doc_types = ["barangay_clearance", "certificate_of_residency", "certificate_of_indigency"]
    purposes = ["Employment", "Local Employment", "Scholarship Application", "Medical Assistance", "School Requirement"]
    for i in range(8):
        doc_type = doc_types[i % len(doc_types)]
        doc_request = {
            "id": secrets.token_urlsafe(16),
            "resident_id": inserted_residents[i % len(inserted_residents)],
            "document_type": doc_type, "purpose": purposes[i % len(purposes)],
            "status": "approved" if i < 4 else "pending",
            "document_number": generate_document_number(doc_type),
            "additional_details": {},
            "created_at": datetime.now(timezone.utc) - timedelta(days=i),
            "created_by": user["_id"]
        }
        if doc_request["status"] == "approved":
            doc_request["issue_date"] = datetime.now(timezone.utc) - timedelta(days=max(i-1, 0))
        await db.document_requests.insert_one(doc_request)

    # Blotters
    for i in range(3):
        blotter = {
            "id": secrets.token_urlsafe(16),
            "case_number": f"BL-{datetime.now().strftime('%Y%m%d')}-{i+1:03d}",
            "complainant_id": inserted_residents[i],
            "complainant_name": sample_residents[i]["full_name"],
            "respondent_name": ["Unknown Person", "John Smith", "Jane Doe"][i],
            "incident_type": ["Noise Complaint", "Property Dispute", "Verbal Altercation"][i],
            "incident_date": datetime.now(timezone.utc).isoformat(),
            "incident_location": "Near barangay hall",
            "description": "Sample incident description.",
            "status": ["pending", "mediation", "resolved"][i],
            "created_at": datetime.now(timezone.utc) - timedelta(days=i*2),
            "created_by": user["_id"]
        }
        await db.blotters.insert_one(blotter)

    # Businesses
    for i in range(3):
        biz = {
            "id": secrets.token_urlsafe(16),
            "business_name": ["Sari-Sari Store", "Barber Shop", "Computer Shop"][i],
            "owner_id": inserted_residents[i],
            "owner_name": sample_residents[i]["full_name"],
            "business_type": ["Retail", "Service", "Service"][i],
            "address": sample_residents[i]["address"],
            "contact_number": sample_residents[i]["contact_number"],
            "capitalization": [50000, 30000, 100000][i],
            "employees_count": [1, 2, 3][i],
            "permit_number": f"BP-{datetime.now().strftime('%Y%m%d')}{i:03d}",
            "status": "active",
            "registered_date": datetime.now(timezone.utc) - timedelta(days=30*i),
            "expiry_date": datetime.now(timezone.utc) + timedelta(days=365-(30*i)),
            "created_at": datetime.now(timezone.utc) - timedelta(days=30*i),
            "created_by": user["_id"]
        }
        await db.businesses.insert_one(biz)

    return {"message": "Sample data seeded", "residents_added": len(sample_residents), "documents_added": 8, "blotters_added": 3, "businesses_added": 3}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('FRONTEND_URL', 'http://localhost:3000').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
