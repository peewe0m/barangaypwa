from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib import colors
from datetime import datetime
import qrcode
import io
from config.system import SYSTEM_CONFIG


def generate_qr_code(data: str) -> bytes:
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf.getvalue()


def _base_header(elements, styles, title):
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#2d6a4f'), spaceAfter=20, alignment=TA_CENTER, fontName='Helvetica-Bold')
    bi = SYSTEM_CONFIG['barangay_info']
    header_text = f"""
    <para align=center>
    <b>Republic of the Philippines</b><br/>
    Province of {bi['province']}<br/>
    Municipality of {bi['municipality']}<br/>
    <b>BARANGAY {bi['name'].upper()}</b><br/>
    Office of the Barangay Captain
    </para>
    """
    elements.append(Paragraph(header_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(title, title_style))
    elements.append(Spacer(1, 0.2*inch))


def _signature_block(elements, styles):
    bi = SYSTEM_CONFIG['barangay_info']
    sig_data = [
        ['', ''],
        [Paragraph(f"<b>{bi['captain_name'].upper()}</b>", styles['Normal']),
         Paragraph(f"<b>{bi['secretary_name'].upper()}</b>", styles['Normal'])],
        ['Punong Barangay', 'Barangay Secretary']
    ]
    sig_table = Table(sig_data, colWidths=[3*inch, 3*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LINEABOVE', (0, 1), (0, 1), 1, colors.black),
        ('LINEABOVE', (1, 1), (1, 1), 1, colors.black),
    ]))
    elements.append(sig_table)


def _generic_certificate(title, doc_type_prefix, body_template):
    def _gen(resident_data: dict, request_data: dict) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        _base_header(elements, styles, title)
        doc_number = request_data.get('document_number', 'N/A')
        issue_date = datetime.fromisoformat(request_data.get('issue_date')).strftime('%B %d, %Y') if request_data.get('issue_date') else datetime.now().strftime('%B %d, %Y')
        elements.append(Paragraph(f"<b>Document No.:</b> {doc_number}", styles['Normal']))
        elements.append(Paragraph(f"<b>Date Issued:</b> {issue_date}", styles['Normal']))
        elements.append(Spacer(1, 0.2*inch))
        elements.append(Paragraph("<b>TO WHOM IT MAY CONCERN:</b>", styles['Normal']))
        elements.append(Spacer(1, 0.15*inch))
        body_style = ParagraphStyle('Body', parent=styles['Normal'], alignment=TA_JUSTIFY, spaceAfter=12, leading=20)
        body_text = body_template.format(
            full_name=resident_data.get('full_name', 'N/A').upper(),
            age=resident_data.get('age', 'N/A'),
            civil_status=resident_data.get('civil_status', 'N/A'),
            address=resident_data.get('address', 'N/A'),
            purpose=request_data.get('purpose', 'General Purpose'),
            issue_date=issue_date,
        )
        elements.append(Paragraph(body_text, body_style))
        elements.append(Spacer(1, 0.4*inch))
        _signature_block(elements, styles)
        qr_data = f"{doc_type_prefix}|{doc_number}|{resident_data.get('full_name')}|{issue_date}"
        qr_bytes = generate_qr_code(qr_data)
        qr_image = Image(io.BytesIO(qr_bytes), width=1*inch, height=1*inch)
        elements.append(Spacer(1, 0.3*inch))
        elements.append(qr_image)
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    return _gen


generate_barangay_clearance = _generic_certificate(
    "BARANGAY CLEARANCE", "CLEARANCE",
    "This is to certify that <b>{full_name}</b>, {age} years old, {civil_status}, Filipino citizen, and a resident of {address}, is personally known to me to be of good moral character and law-abiding citizen in this community.<br/><br/>This certification is being issued upon the request of the above-named person for <b>{purpose}</b> and for whatever legal purpose it may serve.<br/><br/>Issued this {issue_date}."
)

generate_certificate_of_residency = _generic_certificate(
    "CERTIFICATE OF RESIDENCY", "RESIDENCY",
    "This is to certify that <b>{full_name}</b>, {age} years old, {civil_status}, is a bonafide resident of {address} and has been residing in this barangay.<br/><br/>This certification is issued upon the request of the above-named person for <b>{purpose}</b>.<br/><br/>Issued this {issue_date}."
)

generate_certificate_of_indigency = _generic_certificate(
    "CERTIFICATE OF INDIGENCY", "INDIGENCY",
    "This is to certify that <b>{full_name}</b>, {age} years old, {civil_status}, residing at {address}, belongs to an indigent family in this barangay.<br/><br/>This certification is issued for the purpose of <b>{purpose}</b>.<br/><br/>Issued this {issue_date}."
)

generate_good_moral = _generic_certificate(
    "GOOD MORAL CHARACTER CERTIFICATE", "GOODMORAL",
    "This is to certify that <b>{full_name}</b>, {age} years old, {civil_status}, residing at {address}, is of good moral character and has no derogatory record in this barangay.<br/><br/>This certification is issued upon the request of the above-named person for <b>{purpose}</b>.<br/><br/>Issued this {issue_date}."
)

generate_first_time_job_seeker = _generic_certificate(
    "FIRST TIME JOB SEEKER CERTIFICATE", "FTJSEEKER",
    "This is to certify that <b>{full_name}</b>, {age} years old, residing at {address}, is a first-time job seeker and is qualified to avail of the benefits under R.A. 11261.<br/><br/>This certification is issued for <b>{purpose}</b>.<br/><br/>Issued this {issue_date}."
)

generate_solo_parent = _generic_certificate(
    "SOLO PARENT CERTIFICATE", "SOLOPARENT",
    "This is to certify that <b>{full_name}</b>, {age} years old, {civil_status}, residing at {address}, is a recognized solo parent under R.A. 8972.<br/><br/>This certification is issued for <b>{purpose}</b>.<br/><br/>Issued this {issue_date}."
)

generate_cohabitation = _generic_certificate(
    "CERTIFICATE OF COHABITATION", "COHABITATION",
    "This is to certify that <b>{full_name}</b>, {age} years old, has been cohabiting with their partner at {address}.<br/><br/>This certification is issued for <b>{purpose}</b>.<br/><br/>Issued this {issue_date}."
)

generate_business_clearance_pdf = _generic_certificate(
    "BUSINESS CLEARANCE", "BUSINESS",
    "This is to certify that <b>{full_name}</b>, residing at {address}, has been granted a Barangay Business Clearance for the purpose of <b>{purpose}</b>.<br/><br/>The business owner has complied with the requirements set forth by this Barangay.<br/><br/>Issued this {issue_date}."
)


def generate_barangay_id(resident_data: dict, id_data: dict, photo_bytes: bytes = None) -> bytes:
    """Generate Barangay ID Card PDF (front + back side by side)"""
    buffer = io.BytesIO()
    id_width = 3.375 * inch
    id_height = 2.125 * inch
    # Use a larger page so two cards fit comfortably with margins
    page_width = id_width * 2 + 0.75 * inch
    page_height = id_height + 0.75 * inch
    doc = SimpleDocTemplate(buffer, pagesize=(page_width, page_height),
                            leftMargin=0.2*inch, rightMargin=0.2*inch,
                            topMargin=0.2*inch, bottomMargin=0.2*inch)
    elements = []
    bi = SYSTEM_CONFIG['barangay_info']
    id_number = id_data.get('id_number', 'N/A')

    title_style = ParagraphStyle('IDTitle', fontSize=7, alignment=TA_CENTER, fontName='Helvetica-Bold', textColor=colors.white)
    info_style = ParagraphStyle('IDInfo', fontSize=6, alignment=TA_LEFT, leading=8)
    name_style = ParagraphStyle('IDName', fontSize=8, alignment=TA_LEFT, fontName='Helvetica-Bold', leading=10)

    qr_data = f"BID|{id_number}|{resident_data.get('full_name')}|{bi['name']}"
    qr_bytes = generate_qr_code(qr_data)
    qr_img = Image(io.BytesIO(qr_bytes), width=0.7*inch, height=0.7*inch)

    photo_cell_content = Paragraph("<para align=center><b>PHOTO</b></para>", info_style)
    if photo_bytes:
        try:
            photo_cell_content = Image(io.BytesIO(photo_bytes), width=0.8*inch, height=1.0*inch)
        except Exception:
            pass

    addr_truncated = (resident_data.get('address', '') or '')[:35]

    # Front card: header row + body row with photo + info
    front_body = Table([
        [photo_cell_content,
         Paragraph(
             f"<b>{resident_data.get('full_name', '').upper()}</b><br/>"
             f"<font size=5>ID: {id_number}<br/>"
             f"Age: {resident_data.get('age')} | {resident_data.get('gender')}<br/>"
             f"Status: {resident_data.get('civil_status')}<br/>"
             f"Addr: {addr_truncated}</font>",
             name_style
         )]
    ], colWidths=[0.9*inch, 2.1*inch], rowHeights=[1.1*inch])
    front_body.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))

    front_data = [
        [Paragraph(f"<para align=center><b>BARANGAY {bi['name'].upper()}</b><br/>"
                   f"<font size=6>{bi['municipality']}, {bi['province']}</font></para>", title_style)],
        [front_body]
    ]
    front_table = Table(front_data, colWidths=[id_width - 0.1*inch], rowHeights=[0.4*inch, 1.2*inch])
    front_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d6a4f')),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('VALIGN', (0, 1), (-1, 1), 'TOP'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2d6a4f')),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
    ]))

    # Back card
    back_body = Table([
        [qr_img,
         Paragraph(
             f"<font size=5><b>If found, return to:</b><br/>"
             f"{bi['address'][:50]}<br/><br/>"
             f"Tel: {bi['contact_number']}<br/>"
             f"Email: {bi['email']}<br/><br/>"
             f"Property of Barangay {bi['name']}.</font>",
             info_style
         )]
    ], colWidths=[0.85*inch, 2.15*inch], rowHeights=[1.1*inch])
    back_body.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))

    back_data = [
        [Paragraph("<para align=center><b>OFFICIAL BARANGAY ID</b></para>", title_style)],
        [back_body]
    ]
    back_table = Table(back_data, colWidths=[id_width - 0.1*inch], rowHeights=[0.4*inch, 1.2*inch])
    back_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d6a4f')),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('VALIGN', (0, 1), (-1, 1), 'TOP'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2d6a4f')),
    ]))

    combined = Table([[front_table, back_table]], colWidths=[id_width, id_width])
    combined.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(combined)
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
