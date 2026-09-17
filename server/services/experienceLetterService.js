import PDFDocument from "pdfkit";

/**
 * Format a Date object to "DD Month YYYY"
 */
export const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

/**
 * Generate Experience Letter PDF Stream using PDFKit
 * Reuses the styling conventions, palette, and fonts from payslipController.js.
 *
 * @param {Object} params
 * @param {Object} params.offboarding - OffboardingProcess document
 * @param {Object} params.employee - Populated Employee document with user_id and department_id
 * @param {Object} params.organization - Organization document with name, address, contact details
 * @param {Date|string} [params.startDate] - Start date from OnboardingProcess or Employee.date_of_joining
 * @param {Array<string>} [params.tasks] - Distinct task titles assigned to the employee
 * @param {string} [params.signatoryName] - Optional HR signatory name
 * @returns {PDFDocument} The PDF document stream
 */
export const createExperienceLetterPDF = ({
  offboarding,
  employee,
  organization,
  startDate,
  tasks = [],
  signatoryName = "Human Resources Department",
  compress = false,
}) => {
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    bufferPages: true,
    compress,
  });

  const primary = "#6C5CE7"; // Purple/indigo theme accent
  const primaryDark = "#1E293B"; // Slate dark
  const textDark = "#1F2937"; // Charcoal text
  const midGray = "#64748B"; // Slate gray
  const lightGray = "#F8FAFC"; // Soft background

  const pageWidth = doc.page.width;
  const marginX = 50;
  const contentWidth = pageWidth - marginX * 2;

  const orgName = organization?.name || "The Organization";
  const orgAddress = organization?.address || "";
  const orgEmail = organization?.contactEmail || "";
  const orgPhone = organization?.contactPhone || "";
  const orgCode = organization?.orgCode || organization?.code || "ORG";

  const user = employee?.user_id || {};
  const empName = user.name || "Employee";
  const empCode = employee?.employee_code || "EMP";
  const designation = employee?.designation || "Employee";
  const deptName =
    employee?.department_id?.departmentName || user.department || "General";

  const startFormatted = formatDate(startDate || employee?.date_of_joining);
  const lwdFormatted = formatDate(offboarding?.last_working_day);
  const resignFormatted = formatDate(offboarding?.resignation_date);
  const issueDateFormatted = formatDate(new Date());
  const year = new Date().getFullYear();
  const refNumber = `EXP/${orgCode}/${empCode}/${year}`;

  // =========================================================================
  // 1. LETTERHEAD & ORGANIZATION HEADER
  // =========================================================================
  // Top accent bar
  doc.rect(0, 0, pageWidth, 8).fill(primary);

  let y = 35;
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(primaryDark)
    .text(orgName.toUpperCase(), marginX, y, { width: contentWidth, align: "left" });

  y += 24;

  const contactLineParts = [];
  if (orgAddress) contactLineParts.push(orgAddress);
  if (orgEmail) contactLineParts.push(`Email: ${orgEmail}`);
  if (orgPhone) contactLineParts.push(`Phone: ${orgPhone}`);

  if (contactLineParts.length > 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(midGray)
      .text(contactLineParts.join("  |  "), marginX, y, {
        width: contentWidth,
        align: "left",
      });
    y += 18;
  }

  // Divider
  doc
    .moveTo(marginX, y)
    .lineTo(pageWidth - marginX, y)
    .strokeColor("#E2E8F0")
    .lineWidth(1)
    .stroke();

  y += 16;

  // =========================================================================
  // 2. REFERENCE AND DATE
  // =========================================================================
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(midGray)
    .text(`Ref: ${refNumber}`, marginX, y, { width: contentWidth / 2, align: "left" });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(midGray)
    .text(`Date: ${issueDateFormatted}`, marginX + contentWidth / 2, y, {
      width: contentWidth / 2,
      align: "right",
    });

  y += 28;

  // =========================================================================
  // 3. CERTIFICATE TITLE
  // =========================================================================
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(midGray)
    .text("TO WHOMSOEVER IT MAY CONCERN", marginX, y, {
      width: contentWidth,
      align: "center",
      characterSpacing: 1,
    });

  y += 18;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(primary)
    .text("EXPERIENCE & RELIEVING CERTIFICATE", marginX, y, {
      width: contentWidth,
      align: "center",
    });

  y += 26;

  // =========================================================================
  // 4. MAIN CERTIFICATION BODY
  // =========================================================================
  doc.font("Helvetica").fontSize(10.5).fillColor(textDark);

  const para1 = `This is to certify that ${empName} (Employee Code: ${empCode}) was employed with ${orgName} from ${startFormatted} to ${lwdFormatted}.`;
  doc.text(para1, marginX, y, { width: contentWidth, align: "justify", lineGap: 4 });
  y = doc.y + 10;

  const para2 = `At the time of relieving, ${empName} was holding the position of ${designation} in the ${deptName} department.`;
  doc.text(para2, marginX, y, { width: contentWidth, align: "justify", lineGap: 4 });
  y = doc.y + 14;

  // =========================================================================
  // 5. TASKS / PROJECTS SECTION (OR PROFESSIONAL CONTRIBUTIONS FALLBACK)
  // =========================================================================
  const distinctTasks = Array.isArray(tasks)
    ? [...new Set(tasks.map((t) => (typeof t === "string" ? t.trim() : t?.title?.trim())).filter(Boolean))]
    : [];

  if (distinctTasks.length > 0) {
    // Has matching assigned tasks/projects
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(primaryDark)
      .text("KEY ASSIGNED DELIVERABLES & PROJECTS:", marginX, y, {
        width: contentWidth,
      });
    y = doc.y + 4;

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(textDark)
      .text(
        `During the tenure with the organization, ${empName} successfully contributed to the following key initiatives and deliverables:`,
        marginX,
        y,
        { width: contentWidth, align: "justify", lineGap: 3 }
      );
    y = doc.y + 6;

    // List top tasks with bullets (up to 6 to prevent layout overflow)
    const displayTasks = distinctTasks.slice(0, 6);
    displayTasks.forEach((taskTitle) => {
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(textDark)
        .text(`•   ${taskTitle}`, marginX + 12, y, {
          width: contentWidth - 24,
          lineGap: 3,
        });
      y = doc.y + 3;
    });
    y += 8;
  } else {
    // REQUIREMENT 1: Clean fallback when no tasks/projects exist
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(primaryDark)
      .text("PROFESSIONAL CONTRIBUTIONS:", marginX, y, { width: contentWidth });
    y = doc.y + 4;

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(textDark)
      .text(
        `During their tenure with the organization, ${empName} contributed diligently to various team responsibilities, department workflows, and organizational initiatives.`,
        marginX,
        y,
        { width: contentWidth, align: "justify", lineGap: 3 }
      );
    y = doc.y + 12;
  }

  // =========================================================================
  // 6. CONDUCT & CHARACTER
  // =========================================================================
  const conductText = `During their period of service with us, we found ${empName} to be hardworking, sincere, and professional in discharging their duties and assigned responsibilities. Their conduct and character have been found to be exemplary.`;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(textDark)
    .text(conductText, marginX, y, { width: contentWidth, align: "justify", lineGap: 4 });
  y = doc.y + 10;

  // =========================================================================
  // 7. RELIEVING & SETTLEMENT CONFIRMATION
  // =========================================================================
  const relievingText = `Their formal resignation dated ${resignFormatted} was duly accepted, and they have been officially relieved of their responsibilities with effect from the close of business hours on ${lwdFormatted}, having successfully completed all department clearances and handovers.`;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(textDark)
    .text(relievingText, marginX, y, { width: contentWidth, align: "justify", lineGap: 4 });
  y = doc.y + 10;

  // Best wishes
  const closingText = `We thank ${empName} for their valuable services and contributions to ${orgName}, and we wish them every success in all their future personal and professional endeavors.`;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(textDark)
    .text(closingText, marginX, y, { width: contentWidth, align: "justify", lineGap: 4 });
  y = doc.y + 26;

  // =========================================================================
  // 8. SIGNATURE BLOCK
  // =========================================================================
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(primaryDark)
    .text(`For ${orgName},`, marginX, y);

  y += 45; // Space for signature stamp

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(textDark)
    .text("Authorized Signatory", marginX, y);
  y += 14;

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(midGray)
    .text(signatoryName, marginX, y);

  // =========================================================================
  // 9. FOOTER
  // =========================================================================
  const footerY = doc.page.height - 40;
  doc
    .moveTo(marginX, footerY - 8)
    .lineTo(pageWidth - marginX, footerY - 8)
    .strokeColor("#E2E8F0")
    .lineWidth(0.75)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(midGray)
    .text(
      `This is an official certificate issued by ${orgName}. Ref: ${refNumber}`,
      marginX,
      footerY,
      { width: contentWidth, align: "center" }
    );

  return doc;
};
