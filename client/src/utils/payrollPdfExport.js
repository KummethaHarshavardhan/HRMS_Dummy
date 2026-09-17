import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getMonthName, getEmployeeDisplay } from './payrollConstants';

/**
 * Generates and downloads a comprehensive payslip & salary statement PDF.
 * Supports:
 *  - Specific Year + All Months (Annual Month-wise Breakdown)
 *  - Specific Year + Specific Month (Monthly Statement)
 *  - All Years + All Months (Complete Cumulative Statement)
 *
 * @param {Object} params
 * @param {Array} params.payrolls - Filtered array of payroll objects
 * @param {string|number} params.monthFilter - Selected month filter ('' or 1-12)
 * @param {string|number} params.yearFilter - Selected year filter ('' or 2026, etc.)
 * @param {Object} params.user - Current user object
 */
export const exportPayrollPDF = ({ payrolls = [], monthFilter = '', yearFilter = '', user = null }) => {
  if (!payrolls || payrolls.length === 0) {
    throw new Error('No payroll records available to export for the selected filter.');
  }

  // Sort chronologically (year ascending, month ascending)
  const sorted = [...payrolls].sort((a, b) => {
    if (Number(a.year) !== Number(b.year)) {
      return Number(a.year) - Number(b.year);
    }
    return Number(a.month) - Number(b.month);
  });

  const empDisplay = getEmployeeDisplay(sorted[0]?.employeeId, sorted[0]?.employeeSnapshot);
  const empName = empDisplay.name || user?.name || 'Employee';
  const empCode = empDisplay.code || 'EMP';
  const empDept = empDisplay.dept || user?.department || 'Human Resources';
  const empDesig = empDisplay.desig || user?.designation || 'Staff';

  // Determine Title & Filename based on filter context
  let statementTitle = 'PAYROLL & SALARY STATEMENT';
  let periodLabel = 'All Years & Months';
  let fileName = `Payslips_${empCode}_AllYears.pdf`;

  if (yearFilter && !monthFilter) {
    statementTitle = `ANNUAL PAYSLIP & SALARY STATEMENT (${yearFilter})`;
    periodLabel = `Year ${yearFilter} (Month-wise Breakdown)`;
    fileName = `Payslips_${empCode}_Year_${yearFilter}.pdf`;
  } else if (yearFilter && monthFilter) {
    const mName = getMonthName(monthFilter);
    statementTitle = `MONTHLY PAYSLIP STATEMENT (${mName.toUpperCase()} ${yearFilter})`;
    periodLabel = `${mName} ${yearFilter}`;
    fileName = `Payslip_${empCode}_${mName}_${yearFilter}.pdf`;
  } else if (!yearFilter && monthFilter) {
    const mName = getMonthName(monthFilter);
    statementTitle = `PAYSLIP STATEMENT - ${mName.toUpperCase()} (ALL YEARS)`;
    periodLabel = `${mName} (All Recorded Years)`;
    fileName = `Payslips_${empCode}_${mName}_AllYears.pdf`;
  }

  // Calculate cumulative totals
  const totalBasic = sorted.reduce((sum, p) => sum + Number(p.basicSalary || 0), 0);
  const totalHRA = sorted.reduce((sum, p) => sum + Number(p.hra || 0), 0);
  const totalAllowances = sorted.reduce((sum, p) => sum + Number(p.allowances || 0), 0);
  const totalBonus = sorted.reduce((sum, p) => sum + Number(p.bonus || 0), 0);
  const totalDeductions = sorted.reduce((sum, p) => sum + Number(p.deductions || 0), 0);
  const totalGross = sorted.reduce((sum, p) => sum + Number(p.grossSalary || 0), 0);
  const totalNet = sorted.reduce((sum, p) => sum + Number(p.netSalary || 0), 0);
  const totalDays = sorted.reduce((sum, p) => sum + Number(p.daysPresent || 0), 0);
  const totalWorkDays = sorted.reduce((sum, p) => sum + Number(p.totalWorkingDays || 0), 0);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color palette
  const headerBg = [30, 27, 75]; // Deep Indigo
  const cardBg = [248, 250, 252]; // Slate-50

  // 1. Top Decorative Brand Banner
  doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INFINETRA HRMS', 14, 12);

  doc.setFontSize(11);
  doc.setTextColor(224, 231, 255);
  doc.text(statementTitle, 14, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254);
  const genDate = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  doc.text(genDate, pageWidth - 14, 18, { align: 'right' });

  // 2. Employee Details Card
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.roundedRect(14, 33, pageWidth - 28, 22, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 33, pageWidth - 28, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('EMPLOYEE NAME', 20, 39);
  doc.text('EMPLOYEE CODE', 85, 39);
  doc.text('DEPARTMENT', 145, 39);
  doc.text('STATEMENT SCOPE', 210, 39);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(empName, 20, 48);
  doc.text(empCode, 85, 48);
  doc.text(empDept, 145, 48);
  doc.text(periodLabel, 210, 48);

  // 3. Summary Metric Cards
  const cardY = 59;
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 16;

  const metrics = [
    { label: 'Total Net Disbursed', value: `Rs. ${totalNet.toLocaleString('en-IN')}`, color: [16, 185, 129] },
    { label: 'Total Gross Earnings', value: `Rs. ${totalGross.toLocaleString('en-IN')}`, color: [79, 70, 229] },
    { label: 'Total Deductions', value: `Rs. ${totalDeductions.toLocaleString('en-IN')}`, color: [239, 68, 68] },
    { label: 'Processed Statements', value: `${sorted.length} Month(s)`, color: [51, 65, 85] },
  ];

  metrics.forEach((m, idx) => {
    const cx = 14 + idx * (cardWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label.toUpperCase(), cx + 6, cardY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.value, cx + 6, cardY + 12);
  });

  // 4. AutoTable Configuration
  const fmt = (num) => `Rs. ${Number(num || 0).toLocaleString('en-IN')}`;

  const tableRows = sorted.map((p, index) => {
    const mName = getMonthName(p.month);
    const payDateStr = p.paymentDate
      ? new Date(p.paymentDate).toLocaleDateString('en-IN')
      : (p.status === 'Paid' ? 'Paid' : 'Pending');
    return [
      String(index + 1),
      `${mName} ${p.year}`,
      `${p.daysPresent || 0} / ${p.totalWorkingDays || 0}`,
      fmt(p.basicSalary),
      fmt(p.hra),
      fmt(p.allowances),
      fmt(p.bonus),
      fmt(p.deductions),
      fmt(p.grossSalary),
      fmt(p.netSalary),
      p.status || 'Generated',
      payDateStr,
    ];
  });

  // Totals / Summary Row
  const totalRow = [
    'TOTAL',
    `${sorted.length} Month(s)`,
    `${totalDays} / ${totalWorkDays}`,
    fmt(totalBasic),
    fmt(totalHRA),
    fmt(totalAllowances),
    fmt(totalBonus),
    fmt(totalDeductions),
    fmt(totalGross),
    fmt(totalNet),
    '-',
    '-',
  ];

  autoTable(doc, {
    head: [[
      '#',
      'Pay Period',
      'Attendance',
      'Basic Pay',
      'HRA',
      'Allowances',
      'Bonus',
      'Deductions',
      'Gross Salary',
      'Net Pay',
      'Status',
      'Payment Date',
    ]],
    body: tableRows,
    foot: [totalRow],
    startY: 80,
    margin: { left: 14, right: 14, bottom: 14 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.2,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', textColor: [220, 38, 38] },
      8: { halign: 'right', fontStyle: 'bold' },
      9: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
      10: { halign: 'center' },
      11: { halign: 'center' },
    },
    didDrawPage: () => {
      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'This is a system-generated compensation statement issued by HRMS and is valid without a physical signature.',
        14,
        pageHeight - 6
      );
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
    },
  });

  doc.save(fileName);
};