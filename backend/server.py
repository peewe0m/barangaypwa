from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
import io

from utils.auth_helpers import (
    hash_password, verify_password, create_access_token, 
    create_refresh_token, get_current_user
)
from utils.pdf_generator import (
    generate_barangay_clearance, generate_certificate_of_residency,
    generate_certificate_of_indigency, generate_qr_code
)
from config.system import SYSTEM_CONFIG

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ PYDANTIC MODELS ============

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

class ResidentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    full_name: str
    address: str
    birthdate: str
    age: int
    gender: str
    civil_status: str
    citizenship: str
    contact_number: Optional[str] = None
    occupation: Optional[str] = None
    email: Optional[EmailStr] = None
    religion: Optional[str] = None
    is_voter: bool
    is_pwd: bool
    is_senior: bool
    is_solo_parent: bool
    emergency_contact: Optional[str] = None
    household_id: Optional[str] = None
    created_at: str

class HouseholdCreate(BaseModel):
    household_head: str
    address: str
    members: List[str] = []

class DocumentRequestCreate(BaseModel):
    resident_id: str
    document_type: str
    purpose: str
    additional_details: Optional[dict] = {}

class DocumentRequestResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    resident_id: str
    document_type: str
    purpose: str
    status: str
    document_number: str
    issue_date: Optional[str] = None
    created_at: str

class BlotterCreate(BaseModel):
    complainant_id: str
    respondent_name: str
    incident_type: str
    incident_date: str
    incident_location: str
    description: str
    status: str = "pending"

class PaymentCreate(BaseModel):
    document_request_id: str
    amount: float
    payment_method: str = "cash"

# ============ STARTUP EVENTS ============

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.residents.create_index("full_name")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    
    # Seed admin
    await seed_admin()
    logger.info("Database indexes created and admin seeded")

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@barangay.gov.ph")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "full_name": "System Administrator",
            "role": "super_admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated")
    
    # Write test credentials
    credentials_content = f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: super_admin

## API Endpoints
- Login: POST /api/auth/login
- Register: POST /api/auth/register
- Get Current User: GET /api/auth/me
- Logout: POST /api/auth/logout
"""
    Path("/app/memory").mkdir(exist_ok=True)
    Path("/app/memory/test_credentials.md").write_text(credentials_content)

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user_data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "full_name": user_data.full_name,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token", value=access_token, httponly=True,
        secure=False, samesite="lax", max_age=900, path="/"
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True,
        secure=False, samesite="lax", max_age=604800, path="/"
    )
    
    return {
        "id": user_id,
        "email": email,
        "full_name": user_data.full_name,
        "role": user_data.role
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    email = credentials.email.lower()
    
    # Check brute force
    identifier = email
    attempt_doc = await db.login_attempts.find_one({"identifier": identifier})
    if attempt_doc and attempt_doc.get("attempts", 0) >= 5:
        locked_until = attempt_doc.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < locked_until:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        # Increment failed attempts
        if attempt_doc:
            new_attempts = attempt_doc.get("attempts", 0) + 1
            locked_until = datetime.now(timezone.utc) + timedelta(minutes=15) if new_attempts >= 5 else None
            await db.login_attempts.update_one(
                {"identifier": identifier},
                {"$set": {"attempts": new_attempts, "locked_until": locked_until}}
            )
        else:
            await db.login_attempts.insert_one({
                "identifier": identifier,
                "attempts": 1,
                "locked_until": None
            })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Clear failed attempts
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token", value=access_token, httponly=True,
        secure=False, samesite="lax", max_age=900, path="/"
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True,
        secure=False, samesite="lax", max_age=604800, path="/"
    )
    
    return {
        "id": user_id,
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"]
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request, db)
    return user

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

# ============ RESIDENT ROUTES ============

def calculate_age(birthdate_str: str) -> int:
    try:
        birthdate = datetime.fromisoformat(birthdate_str.split('T')[0])
        today = datetime.now()
        return today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))
    except:
        return 0

@api_router.post("/residents")
async def create_resident(resident: ResidentCreate, request: Request):
    user = await get_current_user(request, db)
    
    age = calculate_age(resident.birthdate)
    resident_doc = resident.model_dump()
    resident_doc["age"] = age
    resident_doc["created_at"] = datetime.now(timezone.utc)
    resident_doc["created_by"] = user["_id"]
    
    result = await db.residents.insert_one(resident_doc)
    resident_doc["id"] = str(result.inserted_id)
    resident_doc.pop("_id", None)
    resident_doc["created_at"] = resident_doc["created_at"].isoformat()
    
    return resident_doc

@api_router.get("/residents")
async def get_residents(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None
):
    user = await get_current_user(request, db)
    
    query = {}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.residents.count_documents(query)
    residents = await db.residents.find(query, {"_id": 0, "created_by": 0}).skip(skip).limit(limit).to_list(length=limit)
    
    for resident in residents:
        if "created_at" in resident and isinstance(resident["created_at"], datetime):
            resident["created_at"] = resident["created_at"].isoformat()
    
    return {"total": total, "residents": residents}

@api_router.get("/residents/{resident_id}")
async def get_resident(resident_id: str, request: Request):
    user = await get_current_user(request, db)
    
    resident = await db.residents.find_one({"id": resident_id}, {"_id": 0})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    if "created_at" in resident and isinstance(resident["created_at"], datetime):
        resident["created_at"] = resident["created_at"].isoformat()
    
    return resident

@api_router.put("/residents/{resident_id}")
async def update_resident(resident_id: str, resident_update: ResidentCreate, request: Request):
    user = await get_current_user(request, db)
    
    age = calculate_age(resident_update.birthdate)
    update_data = resident_update.model_dump()
    update_data["age"] = age
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.residents.update_one({"id": resident_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    return {"message": "Resident updated successfully"}

@api_router.delete("/residents/{resident_id}")
async def delete_resident(resident_id: str, request: Request):
    user = await get_current_user(request, db)
    
    result = await db.residents.delete_one({"id": resident_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    return {"message": "Resident deleted successfully"}

# ============ DOCUMENT REQUEST ROUTES ============

def generate_document_number(doc_type: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    prefix = doc_type[:3].upper()
    return f"{prefix}-{timestamp}"

@api_router.post("/document-requests")
async def create_document_request(doc_request: DocumentRequestCreate, request: Request):
    user = await get_current_user(request, db)
    
    resident = await db.residents.find_one({"id": doc_request.resident_id}, {"_id": 0})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    doc_number = generate_document_number(doc_request.document_type)
    
    request_doc = {
        "id": secrets.token_urlsafe(16),
        "resident_id": doc_request.resident_id,
        "document_type": doc_request.document_type,
        "purpose": doc_request.purpose,
        "status": "pending",
        "document_number": doc_number,
        "additional_details": doc_request.additional_details,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"]
    }
    
    await db.document_requests.insert_one(request_doc)
    request_doc.pop("_id", None)
    request_doc.pop("created_by", None)
    request_doc["created_at"] = request_doc["created_at"].isoformat()
    
    return request_doc

@api_router.get("/document-requests")
async def get_document_requests(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    
    total = await db.document_requests.count_documents({})
    requests = await db.document_requests.find({}, {"_id": 0, "created_by": 0}).skip(skip).limit(limit).to_list(length=limit)
    
    for req in requests:
        if "created_at" in req and isinstance(req["created_at"], datetime):
            req["created_at"] = req["created_at"].isoformat()
        if "issue_date" in req and isinstance(req["issue_date"], datetime):
            req["issue_date"] = req["issue_date"].isoformat()
    
    return {"total": total, "requests": requests}

@api_router.put("/document-requests/{request_id}/approve")
async def approve_document_request(request_id: str, request: Request):
    user = await get_current_user(request, db)
    
    result = await db.document_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "issue_date": datetime.now(timezone.utc), "approved_by": user["_id"]}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document request not found")
    
    return {"message": "Document request approved"}

@api_router.get("/document-requests/{request_id}/download")
async def download_document(request_id: str, request: Request):
    user = await get_current_user(request, db)
    
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
        **doc_request.get("additional_details", {})
    }
    
    doc_type = doc_request["document_type"]
    if doc_type == "barangay_clearance":
        pdf_bytes = generate_barangay_clearance(resident, request_data)
    elif doc_type == "certificate_of_residency":
        pdf_bytes = generate_certificate_of_residency(resident, request_data)
    elif doc_type == "certificate_of_indigency":
        pdf_bytes = generate_certificate_of_indigency(resident, request_data)
    else:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={doc_type}_{doc_request['document_number']}.pdf"}
    )

# ============ DASHBOARD STATS ROUTES ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request, db)
    
    total_residents = await db.residents.count_documents({})
    total_households = await db.households.count_documents({})
    total_pwd = await db.residents.count_documents({"is_pwd": True})
    total_senior = await db.residents.count_documents({"is_senior": True})
    total_solo_parent = await db.residents.count_documents({"is_solo_parent": True})
    total_voters = await db.residents.count_documents({"is_voter": True})
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_transactions = await db.document_requests.count_documents({"created_at": {"$gte": today}})
    
    pending_requests = await db.document_requests.count_documents({"status": "pending"})
    approved_requests = await db.document_requests.count_documents({"status": "approved"})
    
    # Recent activity
    recent_activity = await db.document_requests.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(length=10)
    for activity in recent_activity:
        if "created_at" in activity and isinstance(activity["created_at"], datetime):
            activity["created_at"] = activity["created_at"].isoformat()
    
    return {
        "total_residents": total_residents,
        "total_households": total_households,
        "total_pwd": total_pwd,
        "total_senior": total_senior,
        "total_solo_parent": total_solo_parent,
        "total_voters": total_voters,
        "today_transactions": today_transactions,
        "pending_requests": pending_requests,
        "approved_requests": approved_requests,
        "recent_activity": recent_activity
    }

# ============ BLOTTER ROUTES ============

@api_router.post("/blotters")
async def create_blotter(blotter: BlotterCreate, request: Request):
    user = await get_current_user(request, db)
    
    blotter_doc = blotter.model_dump()
    blotter_doc["id"] = secrets.token_urlsafe(16)
    blotter_doc["case_number"] = f"BL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    blotter_doc["created_at"] = datetime.now(timezone.utc)
    blotter_doc["created_by"] = user["_id"]
    
    await db.blotters.insert_one(blotter_doc)
    blotter_doc.pop("_id", None)
    blotter_doc.pop("created_by", None)
    blotter_doc["created_at"] = blotter_doc["created_at"].isoformat()
    
    return blotter_doc

@api_router.get("/blotters")
async def get_blotters(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    
    total = await db.blotters.count_documents({})
    blotters = await db.blotters.find({}, {"_id": 0, "created_by": 0}).skip(skip).limit(limit).to_list(length=limit)
    
    for blotter in blotters:
        if "created_at" in blotter and isinstance(blotter["created_at"], datetime):
            blotter["created_at"] = blotter["created_at"].isoformat()
    
    return {"total": total, "blotters": blotters}

# ============ HOUSEHOLD ROUTES ============

@api_router.post("/households")
async def create_household(household: HouseholdCreate, request: Request):
    user = await get_current_user(request, db)
    
    household_doc = household.model_dump()
    household_doc["id"] = secrets.token_urlsafe(16)
    household_doc["created_at"] = datetime.now(timezone.utc)
    
    await db.households.insert_one(household_doc)
    household_doc.pop("_id", None)
    household_doc["created_at"] = household_doc["created_at"].isoformat()
    
    return household_doc

@api_router.get("/households")
async def get_households(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    
    total = await db.households.count_documents({})
    households = await db.households.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(length=limit)
    
    for household in households:
        if "created_at" in household and isinstance(household["created_at"], datetime):
            household["created_at"] = household["created_at"].isoformat()
    
    return {"total": total, "households": households}

# ============ PAYMENT ROUTES ============

@api_router.post("/payments")
async def create_payment(payment: PaymentCreate, request: Request):
    user = await get_current_user(request, db)
    
    payment_doc = payment.model_dump()
    payment_doc["id"] = secrets.token_urlsafe(16)
    payment_doc["receipt_number"] = f"OR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    payment_doc["status"] = "completed"
    payment_doc["created_at"] = datetime.now(timezone.utc)
    payment_doc["processed_by"] = user["_id"]
    
    await db.payments.insert_one(payment_doc)
    payment_doc.pop("_id", None)
    payment_doc.pop("processed_by", None)
    payment_doc["created_at"] = payment_doc["created_at"].isoformat()
    
    return payment_doc

@api_router.get("/payments")
async def get_payments(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    
    total = await db.payments.count_documents({})
    payments = await db.payments.find({}, {"_id": 0, "processed_by": 0}).skip(skip).limit(limit).to_list(length=limit)
    
    for payment in payments:
        if "created_at" in payment and isinstance(payment["created_at"], datetime):
            payment["created_at"] = payment["created_at"].isoformat()
    
    return {"total": total, "payments": payments}

# ============ CONFIG ROUTES ============

@api_router.get("/config/system")
async def get_system_config():
    return SYSTEM_CONFIG

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
