# System Configuration for Barangay Management System

SYSTEM_CONFIG = {
    "system_name": "Barangay Management System",
    "version": "1.0.0",
    "barangay_info": {
        "name": "Barangay San Miguel",
        "municipality": "San Pedro City",
        "province": "Laguna",
        "region": "CALABARZON - Region IV-A",
        "contact_number": "+63 917 123 4567",
        "email": "barangaysanmiguel@gmail.com",
        "address": "123 Barangay Hall Road, San Miguel, San Pedro City, Laguna",
        "captain_name": "Juan Dela Cruz",
        "captain_signature": "Juan Dela Cruz",
        "secretary_name": "Maria Santos",
        "secretary_signature": "Maria Santos",
        "treasurer_name": "Pedro Reyes",
    },
    "document_fees": {
        "barangay_clearance": 50.00,
        "certificate_of_residency": 30.00,
        "certificate_of_indigency": 0.00,
        "business_clearance": 500.00,
        "good_moral_certificate": 50.00,
        "first_time_job_seeker": 0.00,
        "solo_parent_certificate": 0.00,
        "cohabitation_certificate": 50.00,
        "barangay_id": 50.00,
    },
    "roles": [
        "super_admin",
        "barangay_captain",
        "secretary",
        "treasurer",
        "kagawad",
        "staff",
        "resident"
    ],
    "document_types": [
        "barangay_clearance",
        "certificate_of_residency",
        "certificate_of_indigency",
        "business_clearance",
        "good_moral_certificate",
        "first_time_job_seeker",
        "solo_parent_certificate",
        "cohabitation_certificate"
    ],
    "civil_status": ["Single", "Married", "Widowed", "Separated", "Divorced"],
    "gender": ["Male", "Female", "Other"],
    "religions": ["Roman Catholic", "Islam", "Iglesia ni Cristo", "Born Again Christian", "Buddhist", "Other"],
}

QR_CONFIG = {
    "version": 1,
    "box_size": 10,
    "border": 4,
    "error_correction": "H",
}

WATERMARK_CONFIG = {
    "text": "BARANGAY SAN MIGUEL",
    "opacity": 0.1,
    "font_size": 60,
}
