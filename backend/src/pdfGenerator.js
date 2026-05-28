import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { SYSTEM_CONFIG } from "./config/system.js";

function collectPdf(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 60 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc).then(() => doc.end()).catch(reject);
  });
}

async function qrBuffer(text) {
  return QRCode.toBuffer(text, { errorCorrectionLevel: "H", width: 120, margin: 1 });
}

function barangayDisplayName(info) {
  const name = String(info?.name || "").trim();
  return /^barangay\s+/i.test(name) ? name : `Barangay ${name}`;
}

function header(doc, title, systemConfig = SYSTEM_CONFIG) {
  const bi = systemConfig.barangay_info;
  doc.fontSize(11).text("Republic of the Philippines", { align: "center" });
  doc.text(`Province of ${bi.province}`, { align: "center" });
  doc.text(`Municipality of ${bi.municipality}`, { align: "center" });
  doc.font("Helvetica-Bold").text(barangayDisplayName(bi).toUpperCase(), { align: "center" });
  doc.font("Helvetica").text("Office of the Barangay Captain", { align: "center" });
  doc.fontSize(9).text(bi.address, { align: "center" });
  doc.text(`${bi.contact_number} | ${bi.email}`, { align: "center" });
  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#2d6a4f").text(title, { align: "center" });
  doc.fillColor("black").font("Helvetica").fontSize(11).moveDown();
}

function signature(doc, systemConfig = SYSTEM_CONFIG) {
  const bi = systemConfig.barangay_info;
  const y = doc.y + 50;
  doc.moveTo(90, y).lineTo(260, y).stroke();
  doc.moveTo(340, y).lineTo(510, y).stroke();
  doc.font("Helvetica-Bold").text(bi.captain_name.toUpperCase(), 90, y + 8, { width: 170, align: "center" });
  doc.text(bi.secretary_name.toUpperCase(), 340, y + 8, { width: 170, align: "center" });
  doc.font("Helvetica").text("Punong Barangay", 90, y + 24, { width: 170, align: "center" });
  doc.text("Barangay Secretary", 340, y + 24, { width: 170, align: "center" });
}

function imageCoverOptions(width, height, options = {}) {
  return {
    cover: [width, height],
    align: options.align || "center",
    valign: options.valign || "center"
  };
}

function drawCroppedImage(doc, imageBuffer, x, y, width, height, options = {}) {
  doc.save();
  doc.rect(x, y, width, height).clip();
  doc.image(imageBuffer, x, y, imageCoverOptions(width, height, options));
  doc.restore();
}

const templates = {
  barangay_clearance: {
    title: "BARANGAY CLEARANCE",
    prefix: "CLEARANCE",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, ${r.age ?? "N/A"} years old, ${r.civil_status || "N/A"}, Filipino citizen, and a resident of ${r.address || "N/A"}, is personally known to me to be of good moral character and law-abiding citizen in this community.\n\nThis certification is being issued upon the request of the above-named person for ${q.purpose || "General Purpose"} and for whatever legal purpose it may serve.\n\nIssued this ${issueDate}.`
  },
  certificate_of_residency: {
    title: "CERTIFICATE OF RESIDENCY",
    prefix: "RESIDENCY",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, ${r.age ?? "N/A"} years old, ${r.civil_status || "N/A"}, is a bonafide resident of ${r.address || "N/A"} and has been residing in this barangay.\n\nThis certification is issued upon the request of the above-named person for ${q.purpose || "General Purpose"}.\n\nIssued this ${issueDate}.`
  },
  certificate_of_indigency: {
    title: "CERTIFICATE OF INDIGENCY",
    prefix: "INDIGENCY",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, ${r.age ?? "N/A"} years old, ${r.civil_status || "N/A"}, residing at ${r.address || "N/A"}, belongs to an indigent family in this barangay.\n\nThis certification is issued for the purpose of ${q.purpose || "General Purpose"}.\n\nIssued this ${issueDate}.`
  },
  business_clearance: {
    title: "BUSINESS CLEARANCE",
    prefix: "BUSINESS",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, residing at ${r.address || "N/A"}, has been granted a Barangay Business Clearance for the purpose of ${q.purpose || "General Purpose"}.\n\nThe business owner has complied with the requirements set forth by this Barangay.\n\nIssued this ${issueDate}.`
  },
  good_moral_certificate: {
    title: "GOOD MORAL CHARACTER CERTIFICATE",
    prefix: "GOODMORAL",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, ${r.age ?? "N/A"} years old, ${r.civil_status || "N/A"}, residing at ${r.address || "N/A"}, is of good moral character and has no derogatory record in this barangay.\n\nThis certification is issued upon request for ${q.purpose || "General Purpose"}.\n\nIssued this ${issueDate}.`
  },
  first_time_job_seeker: {
    title: "FIRST TIME JOB SEEKER CERTIFICATE",
    prefix: "FTJSEEKER",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, ${r.age ?? "N/A"} years old, residing at ${r.address || "N/A"}, is a first-time job seeker and is qualified to avail of the benefits under R.A. 11261.\n\nThis certification is issued for ${q.purpose || "General Purpose"}.\n\nIssued this ${issueDate}.`
  },
  solo_parent_certificate: {
    title: "SOLO PARENT CERTIFICATE",
    prefix: "SOLOPARENT",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, ${r.age ?? "N/A"} years old, ${r.civil_status || "N/A"}, residing at ${r.address || "N/A"}, is a recognized solo parent under R.A. 8972.\n\nThis certification is issued for ${q.purpose || "General Purpose"}.\n\nIssued this ${issueDate}.`
  },
  cohabitation_certificate: {
    title: "CERTIFICATE OF COHABITATION",
    prefix: "COHABITATION",
    body: (r, q, issueDate) => `This is to certify that ${String(r.full_name || "N/A").toUpperCase()}, ${r.age ?? "N/A"} years old, has been cohabiting with their partner at ${r.address || "N/A"}.\n\nThis certification is issued for ${q.purpose || "General Purpose"}.\n\nIssued this ${issueDate}.`
  }
};

export async function generateCertificate(documentType, resident, requestData, templateBuffer = null, applicantPhotoBuffer = null, systemConfig = SYSTEM_CONFIG) {
  const template = templates[documentType] || templates.barangay_clearance;
  const issueDate = requestData.issue_date ? new Date(requestData.issue_date).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" }) : new Date().toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
  const qr = await qrBuffer(`${template.prefix}|${requestData.document_number || "N/A"}|${resident.full_name || ""}|${issueDate}`);

  return collectPdf(async (doc) => {
    if (templateBuffer) {
      try {
        doc.image(templateBuffer, 0, 0, {
          width: doc.page.width,
          height: doc.page.height
        });
      } catch {
        // Ignore invalid image templates and continue with the standard layout.
      }
    }
    header(doc, template.title, systemConfig);
    doc.font("Helvetica-Bold").text("Document No.: ", { continued: true }).font("Helvetica").text(requestData.document_number || "N/A");
    doc.font("Helvetica-Bold").text("Date Issued: ", { continued: true }).font("Helvetica").text(issueDate);
    doc.moveDown().font("Helvetica-Bold").text("TO WHOM IT MAY CONCERN:");
    doc.moveDown().font("Helvetica").fontSize(12).text(template.body(resident, requestData, issueDate), { align: "justify", lineGap: 8 });
    signature(doc, systemConfig);
    if (applicantPhotoBuffer) {
      try {
        const photoY = doc.page.height - 150;
        doc.font("Helvetica-Bold").fontSize(8).text("Applicant Photo", 60, photoY - 14, { width: 95, align: "center" });
        doc.image(applicantPhotoBuffer, 60, photoY, imageCoverOptions(95, 95));
        doc.rect(60, photoY, 95, 95).stroke("#2d6a4f");
      } catch {
        // Continue without the attachment if the stored image cannot be embedded.
      }
    }
    doc.image(qr, doc.page.width - 140, doc.page.height - 150, { width: 80 });
  });
}

export async function generateBarangayId(resident, idData, photoBuffer, systemConfig = SYSTEM_CONFIG) {
  const bi = systemConfig.barangay_info;
  const barangayName = barangayDisplayName(bi);
  const qr = await qrBuffer(`BID|${idData.id_number}|${resident.full_name}|${barangayName}`);

  return collectPdf(async (doc) => {
    doc.rect(60, 80, 240, 154).stroke("#2d6a4f");
    doc.rect(60, 80, 240, 34).fill("#2d6a4f");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10).text(barangayName.toUpperCase(), 70, 90, { width: 220, align: "center" });
    doc.fillColor("black");
    const photoFrame = { x: 74, y: 126, width: 66, height: 86 };
    doc.rect(photoFrame.x, photoFrame.y, photoFrame.width, photoFrame.height).fill("#ffffff");
    if (photoBuffer) {
      try {
        drawCroppedImage(doc, photoBuffer, photoFrame.x + 2, photoFrame.y + 2, photoFrame.width - 4, photoFrame.height - 4, {
          align: "center",
          valign: "top"
        });
      } catch {
        doc.fontSize(8).text("PHOTO", photoFrame.x, photoFrame.y + 36, { width: photoFrame.width, align: "center" });
      }
    } else {
      doc.fontSize(8).text("PHOTO", photoFrame.x, photoFrame.y + 36, { width: photoFrame.width, align: "center" });
    }
    doc.rect(photoFrame.x, photoFrame.y, photoFrame.width, photoFrame.height).stroke("#2d6a4f");
    doc.fillColor("black");
    doc.font("Helvetica-Bold").fontSize(10).text(String(resident.full_name || "").toUpperCase(), 150, 130, { width: 135 });
    doc.font("Helvetica").fontSize(8).text(`ID: ${idData.id_number}`, 150, 148);
    doc.text(`Birthdate: ${String(resident.birthdate || "").split("T")[0]}`, 150, 162);
    doc.text(`Contact: ${resident.contact_number || ""}`, 150, 176);
    doc.text(`Addr: ${String(resident.address || "").slice(0, 35)}`, 150, 190, { width: 135 });

    doc.rect(320, 80, 240, 154).stroke("#2d6a4f");
    doc.rect(320, 80, 240, 34).fill("#2d6a4f");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10).text("OFFICIAL BARANGAY ID", 330, 92, { width: 220, align: "center" });
    doc.fillColor("black").image(qr, 335, 130, { width: 70 });
    doc.font("Helvetica").fontSize(8).text(`If found, return to:\n${bi.address}\n\nTel: ${bi.contact_number}\nEmail: ${bi.email}\n\nProperty of ${barangayName}.`, 420, 130, { width: 120 });
  });
}
