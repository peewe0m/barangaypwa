from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib import colors
from datetime import datetime
import qrcode
import io
from config.system import SYSTEM_CONFIG

def generate_qr_code(data: str) -> bytes:
    """Generate QR code and return as bytes"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.getvalue()

def generate_barangay_clearance(resident_data: dict, request_data: dict) -> bytes:
    """Generate Barangay Clearance PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#2d6a4f'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    # Header
    barangay_info = SYSTEM_CONFIG['barangay_info']
    header_text = f"""
    <para align=center>
    <b>Republic of the Philippines</b><br/>
    Province of {barangay_info['province']}<br/>
    Municipality of {barangay_info['municipality']}<br/>
    <b>BARANGAY {barangay_info['name'].upper()}</b><br/>
    Office of the Barangay Captain
    </para>
    """
    elements.append(Paragraph(header_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    # Document title
    elements.append(Paragraph("BARANGAY CLEARANCE", title_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Document number and date
    doc_number = request_data.get('document_number', 'N/A')
    issue_date = datetime.fromisoformat(request_data.get('issue_date')).strftime('%B %d, %Y') if request_data.get('issue_date') else datetime.now().strftime('%B %d, %Y')
    
    elements.append(Paragraph(f"<b>Clearance No.:</b> {doc_number}", styles['Normal']))
    elements.append(Paragraph(f"<b>Date Issued:</b> {issue_date}", styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    # TO WHOM IT MAY CONCERN
    elements.append(Paragraph("<b>TO WHOM IT MAY CONCERN:</b>", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Body
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        alignment=TA_JUSTIFY,
        spaceAfter=12,
        leading=20
    )
    
    purpose = request_data.get('purpose', 'General Purpose')
    body_text = f"""
    This is to certify that <b>{resident_data.get('full_name', 'N/A').upper()}</b>, 
    {resident_data.get('age', 'N/A')} years old, {resident_data.get('civil_status', 'N/A')}, 
    Filipino citizen, and a resident of {resident_data.get('address', 'N/A')}, is personally known 
    to me to be of good moral character and law-abiding citizen in this community.
    <br/><br/>
    This certification is being issued upon the request of the above-named person for 
    <b>{purpose}</b> and for whatever legal purpose it may serve.
    <br/><br/>
    Issued this {issue_date} at Barangay {barangay_info['name']}, {barangay_info['municipality']}, 
    {barangay_info['province']}, Philippines.
    """
    elements.append(Paragraph(body_text, body_style))
    elements.append(Spacer(1, 0.5*inch))
    
    # Signature
    sig_data = [
        ['', ''],
        [Paragraph(f"<b>{barangay_info['captain_name'].upper()}</b>", styles['Normal']), 
         Paragraph(f"<b>{barangay_info['secretary_name'].upper()}</b>", styles['Normal'])],
        ['Punong Barangay', 'Barangay Secretary']
    ]
    sig_table = Table(sig_data, colWidths=[3*inch, 3*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LINEABOVE', (0, 1), (0, 1), 1, colors.black),
        ('LINEABOVE', (1, 1), (1, 1), 1, colors.black),
    ]))
    elements.append(sig_table)
    
    # QR Code
    qr_data = f"CLEARANCE|{doc_number}|{resident_data.get('full_name')}|{issue_date}"
    qr_bytes = generate_qr_code(qr_data)
    qr_image = Image(io.BytesIO(qr_bytes), width=1*inch, height=1*inch)
    elements.append(Spacer(1, 0.3*inch))
    elements.append(qr_image)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

def generate_certificate_of_residency(resident_data: dict, request_data: dict) -> bytes:
    """Generate Certificate of Residency PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#2d6a4f'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    barangay_info = SYSTEM_CONFIG['barangay_info']
    header_text = f"""
    <para align=center>
    <b>Republic of the Philippines</b><br/>
    Province of {barangay_info['province']}<br/>
    Municipality of {barangay_info['municipality']}<br/>
    <b>BARANGAY {barangay_info['name'].upper()}</b>
    </para>
    """
    elements.append(Paragraph(header_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    elements.append(Paragraph("CERTIFICATE OF RESIDENCY", title_style))
    elements.append(Spacer(1, 0.3*inch))
    
    doc_number = request_data.get('document_number', 'N/A')
    issue_date = datetime.fromisoformat(request_data.get('issue_date')).strftime('%B %d, %Y') if request_data.get('issue_date') else datetime.now().strftime('%B %d, %Y')
    
    elements.append(Paragraph(f"<b>Certificate No.:</b> {doc_number}", styles['Normal']))
    elements.append(Paragraph(f"<b>Date Issued:</b> {issue_date}", styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    elements.append(Paragraph("<b>TO WHOM IT MAY CONCERN:</b>", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))
    
    body_style = ParagraphStyle('BodyText', parent=styles['Normal'], alignment=TA_JUSTIFY, spaceAfter=12, leading=20)
    
    years_resident = request_data.get('years_resident', 'several')
    body_text = f"""
    This is to certify that <b>{resident_data.get('full_name', 'N/A').upper()}</b>, 
    {resident_data.get('age', 'N/A')} years old, {resident_data.get('civil_status', 'N/A')}, 
    is a bonafide resident of {resident_data.get('address', 'N/A')}, since {years_resident} year(s).
    <br/><br/>
    This certification is issued upon the request of the above-named person for whatever legal 
    purpose it may serve.
    """
    elements.append(Paragraph(body_text, body_style))
    elements.append(Spacer(1, 0.5*inch))
    
    sig_data = [
        [''],
        [Paragraph(f"<b>{barangay_info['captain_name'].upper()}</b>", styles['Normal'])],
        ['Punong Barangay']
    ]
    sig_table = Table(sig_data, colWidths=[3*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LINEABOVE', (0, 1), (0, 1), 1, colors.black),
    ]))
    elements.append(sig_table)
    
    qr_data = f"RESIDENCY|{doc_number}|{resident_data.get('full_name')}|{issue_date}"
    qr_bytes = generate_qr_code(qr_data)
    qr_image = Image(io.BytesIO(qr_bytes), width=1*inch, height=1*inch)
    elements.append(Spacer(1, 0.3*inch))
    elements.append(qr_image)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

def generate_certificate_of_indigency(resident_data: dict, request_data: dict) -> bytes:
    """Generate Certificate of Indigency PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#2d6a4f'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    barangay_info = SYSTEM_CONFIG['barangay_info']
    header_text = f"""
    <para align=center>
    <b>Republic of the Philippines</b><br/>
    Province of {barangay_info['province']}<br/>
    Municipality of {barangay_info['municipality']}<br/>
    <b>BARANGAY {barangay_info['name'].upper()}</b>
    </para>
    """
    elements.append(Paragraph(header_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    elements.append(Paragraph("CERTIFICATE OF INDIGENCY", title_style))
    elements.append(Spacer(1, 0.3*inch))
    
    doc_number = request_data.get('document_number', 'N/A')
    issue_date = datetime.fromisoformat(request_data.get('issue_date')).strftime('%B %d, %Y') if request_data.get('issue_date') else datetime.now().strftime('%B %d, %Y')
    
    elements.append(Paragraph(f"<b>Certificate No.:</b> {doc_number}", styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    elements.append(Paragraph("<b>TO WHOM IT MAY CONCERN:</b>", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))
    
    body_style = ParagraphStyle('BodyText', parent=styles['Normal'], alignment=TA_JUSTIFY, spaceAfter=12, leading=20)
    
    body_text = f"""
    This is to certify that <b>{resident_data.get('full_name', 'N/A').upper()}</b>, 
    {resident_data.get('age', 'N/A')} years old, {resident_data.get('civil_status', 'N/A')}, 
    residing at {resident_data.get('address', 'N/A')}, belongs to an indigent family in this barangay.
    <br/><br/>
    This certification is issued for the purpose of <b>{request_data.get('purpose', 'Medical Assistance')}</b>.
    """
    elements.append(Paragraph(body_text, body_style))
    elements.append(Spacer(1, 0.5*inch))
    
    sig_data = [
        [''],
        [Paragraph(f"<b>{barangay_info['captain_name'].upper()}</b>", styles['Normal'])],
        ['Punong Barangay']
    ]
    sig_table = Table(sig_data, colWidths=[3*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LINEABOVE', (0, 1), (0, 1), 1, colors.black),
    ]))
    elements.append(sig_table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
