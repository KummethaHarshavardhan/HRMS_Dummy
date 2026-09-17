import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import User from "../models/UserModel.js";
import Payroll from "../models/Payroll.js";
import Organization from "../models/Organization.js";
import Department from "../models/Department.js";
import OffboardingProcess from "../models/OffboardingProcess.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import PFLedger from "../models/PFLedger.js";
import { createNotification, sendEmail } from "../services/notificationService.js";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const getCleanAccountNumber = (emp) => {
  if (emp?.bank_account_number && String(emp.bank_account_number).trim()) {
    const raw = String(emp.bank_account_number).trim();
    if (raw !== "XXXX6787") return raw;
  }
  if (emp?.account_number && String(emp.account_number).trim()) {
    const raw = String(emp.account_number).trim();
    if (raw !== "XXXX6787") return raw;
  }
  return "";
};

const formatAccountNumber = (acc, phone) => {
  if (acc && String(acc).trim()) {
    const clean = String(acc).trim();
    if (clean.startsWith("XXXX")) return clean;
    return `XXXX${clean.slice(-4)}`;
  }
  if (phone && String(phone).trim()) {
    return `XXXX${String(phone).trim().slice(-4)}`;
  }
  return "XXXX6787";
};

const calculateBonusCooldown = (lastBonusDate) => {
  if (!lastBonusDate) {
    return {
      isBonusEligible: true,
      remainingMonths: 0,
      cooldownText: "Active (Eligible)",
    };
  }

  const last = new Date(lastBonusDate);
  const now = new Date();
  const monthsPassed = (now.getFullYear() - last.getFullYear()) * 12 + (now.getMonth() - last.getMonth());
  const remainingMonths = 12 - monthsPassed;

  if (remainingMonths <= 0) {
    return {
      isBonusEligible: true,
      remainingMonths: 0,
      cooldownText: "Active (Eligible)",
    };
  }

  return {
    isBonusEligible: false,
    remainingMonths,
    cooldownText: `Locked (Active in ${remainingMonths} ${remainingMonths === 1 ? "month" : "months"})`,
  };
};

const sendSalaryCreditedEmail = async ({
  to,
  employeeName,
  employeeRole,
  employeeCode,
  organizationName,
  accountNumber,
  amount,
  monthSalary,
  pfAmount,
  monthName,
  year,
  transactionRef,
}) => {
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "super@gmail.com").trim().toLowerCase();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #4f46e5;">
        <h2 style="color: #4f46e5; margin: 0; font-size: 22px;">Salary Credited Successfully</h2>
        <p style="color: #64748b; margin: 6px 0 0; font-size: 14px;">Payroll Credit Confirmation — ${organizationName}</p>
      </div>

      <p style="font-size: 15px; color: #1e293b; margin-top: 20px;">Dear <strong>${employeeName}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        Your monthly salary for <strong>${monthName} ${year}</strong> has been credited to your bank account. Transaction details are provided below:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569; width: 40%;">Employee ID:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${employeeCode}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Employee Name:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${employeeName} (${employeeRole})</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Organization:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${organizationName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Bank Account:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-family: monospace; font-size: 15px; font-weight: bold;">${accountNumber}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Salary Month:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${monthName} ${year}</td>
        </tr>
        ${
          monthSalary
            ? `<tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Monthly Salary:</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">₹${monthSalary.toLocaleString("en-IN")}/-</td>
              </tr>`
            : ""
        }
        ${
          pfAmount
            ? `<tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">PF Deduction:</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #dc2626;">- ₹${pfAmount.toLocaleString("en-IN")}/-</td>
              </tr>`
            : ""
        }
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Amount Credited:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-size: 18px; font-weight: bold;">₹${amount.toLocaleString("en-IN")}/-</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Status:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: bold;">Credited / Sent</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: bold; color: #475569;">Transaction Ref:</td>
          <td style="padding: 10px 14px; color: #64748b; font-family: monospace; font-size: 12px;">${transactionRef}</td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 24px;">
        This is an automated salary confirmation sent from the Super Admin HRMS Portal.
      </p>
    </div>
  `;

  const recipientList = new Set();
  if (to && String(to).trim()) recipientList.add(String(to).trim().toLowerCase());
  if (process.env.EMAIL && String(process.env.EMAIL).trim()) recipientList.add(String(process.env.EMAIL).trim().toLowerCase());
  if (superAdminEmail && String(superAdminEmail).trim()) recipientList.add(String(superAdminEmail).trim().toLowerCase());

  for (const recipientEmail of recipientList) {
    try {
      await sendEmail({
        to: recipientEmail,
        subject: `Salary Credited — ${organizationName} (${monthName} ${year})`,
        html,
      });
      console.log(`[Payroll Email] Successfully sent salary credit confirmation to: ${recipientEmail}`);
    } catch (mailErr) {
      console.error(`[Payroll Email] Failed to send email to ${recipientEmail}:`, mailErr.message);
    }
  }
};

const sendBonusCreditedEmail = async ({
  to,
  employeeName,
  employeeRole,
  employeeCode,
  organizationName,
  accountNumber,
  amount,
  transactionRef,
}) => {
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "super@gmail.com").trim().toLowerCase();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #eab308;">
        <h2 style="color: #ca8a04; margin: 0; font-size: 22px;">🎉 Annual Bonus Credited!</h2>
        <p style="color: #64748b; margin: 6px 0 0; font-size: 14px;">Special Recognition from ${organizationName}</p>
      </div>

      <p style="font-size: 15px; color: #1e293b; margin-top: 20px;">Dear <strong>${employeeName}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        Congratulations! An annual bonus has been granted by Super Admin and credited directly to your bank account:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #fefce8; border-radius: 8px; overflow: hidden; border: 1px solid #fef08a;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; font-weight: bold; color: #713f12; width: 40%;">Employee ID:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; color: #713f12; font-weight: 600;">${employeeCode}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; font-weight: bold; color: #713f12;">Employee Name:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; color: #713f12;">${employeeName} (${employeeRole})</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; font-weight: bold; color: #713f12;">Organization:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; color: #713f12; font-weight: 600;">${organizationName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; font-weight: bold; color: #713f12;">Bank Account:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; color: #713f12; font-family: monospace; font-size: 15px; font-weight: bold;">${accountNumber}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; font-weight: bold; color: #713f12;">Bonus Amount:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; color: #15803d; font-size: 20px; font-weight: bold;">₹${amount.toLocaleString("en-IN")}/-</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; font-weight: bold; color: #713f12;">Status:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #fef08a; color: #15803d; font-weight: bold;">Credited / Sent</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: bold; color: #713f12;">Cooldown Policy:</td>
          <td style="padding: 10px 14px; color: #854d0e; font-size: 12px;">Locked for 12 months (Next eligible in 1 year)</td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 24px;">
        Thank you for your valuable dedication and commitment!
      </p>
    </div>
  `;

  const recipientList = new Set();
  if (to && String(to).trim()) recipientList.add(String(to).trim().toLowerCase());
  if (process.env.EMAIL && String(process.env.EMAIL).trim()) recipientList.add(String(process.env.EMAIL).trim().toLowerCase());
  if (superAdminEmail && String(superAdminEmail).trim()) recipientList.add(String(superAdminEmail).trim().toLowerCase());

  for (const recipientEmail of recipientList) {
    try {
      await sendEmail({
        to: recipientEmail,
        subject: `Annual Bonus Credited — ${organizationName}`,
        html,
      });
      console.log(`[Bonus Email] Successfully sent bonus credit confirmation to: ${recipientEmail}`);
    } catch (mailErr) {
      console.error(`[Bonus Email] Failed to send bonus email to ${recipientEmail}:`, mailErr.message);
    }
  }
};

// ── GET /api/super-admin/payroll ─────────────────────────────────────────────
export const getSuperAdminPayroll = async (req, res) => {
  try {
    const selectedMonth = parseInt(req.query.month) || new Date().getMonth() + 1;
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
    const rawOrgId = req.query.organizationId || req.query.orgId;
    const organizationId = (rawOrgId && rawOrgId !== "all" && rawOrgId !== "undefined") ? rawOrgId : null;
    const scopedOrgId = (organizationId && mongoose.Types.ObjectId.isValid(organizationId))
      ? new mongoose.Types.ObjectId(organizationId)
      : organizationId;

    // Fetch completed offboardings to cross-verify and guarantee no offboarded employee leaks into payroll
    const offboardQuery = { status: "Completed" };
    if (organizationId) {
      offboardQuery.organizationId = scopedOrgId;
    }
    const completedOffboardings = await OffboardingProcess.find(offboardQuery).select("employee_id completed_at updatedAt organizationId pf_settlement_amount pf_settled");
    const offboardedEmpIds = new Set();
    for (const off of completedOffboardings) {
      const empId = String(off.employee_id?._id || off.employee_id);
      if (!empId) continue;
      const newerOnboard = await OnboardingProcess.findOne({
        employee_id: off.employee_id,
        status: "Completed",
        createdAt: { $gt: off.completed_at || off.updatedAt },
      });
      if (!newerOnboard) {
        offboardedEmpIds.add(empId);
      }
    }

    // Fetch all active employees and HR (exclude SUPER_ADMIN user and Inactive / Offboarded employees)
    const empFilter = { employment_status: "Active" };
    if (organizationId) {
      empFilter.organizationId = scopedOrgId;
    }
    if (offboardedEmpIds.size > 0) {
      const excludedIds = Array.from(offboardedEmpIds).map(id =>
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );
      empFilter._id = { $nin: excludedIds };
    }

    const allEmployees = await Employee.find(empFilter)
      .populate("user_id", "name email role phone department")
      .populate("organizationId", "name organizationId")
      .populate("department_id", "name");

    // Filter out Super Admin account from employee payroll list
    const employees = allEmployees.filter((e) => {
      const userRole = (e.user_id?.role || "").toUpperCase();
      return userRole !== "SUPER_ADMIN" && userRole !== "SUPERADMIN";
    });

    // Fetch payroll records for this year
    let yearPayrolls = [];
    try {
      yearPayrolls = await Payroll.find({ year: selectedYear, status: "Paid" });
    } catch (ypErr) {
      console.warn("yearPayrolls lookup error:", ypErr.message);
    }

    // Helper to guard unmocked Mongoose queries in disconnected unit tests
    const isModelQueryable = (model) => {
      if (mongoose.connection?.readyState === 1) return true;
      if (typeof model?.find === "function" && model.find !== mongoose.Model.find) return true;
      return false;
    };

    // Fetch cumulative PF per employee across employment:
    // Read from PFLedger.total_accumulated_pf (or sum of pf_amount across all paid payroll records)
    const activeEmpIds = employees.map((e) => e._id).filter(Boolean);
    const ledgerMap = new Map();
    const paidPayrollsSumMap = new Map();
    const mostRecentPayrollMap = new Map();
    const allPaidPayrollsList = [];

    if (activeEmpIds.length > 0) {
      if (isModelQueryable(PFLedger)) {
        try {
          const ledgers = await PFLedger.find({ employee_id: { $in: activeEmpIds } });
          if (Array.isArray(ledgers)) {
            for (const l of ledgers) {
              const empKey = String(l.employee_id?._id || l.employee_id);
              ledgerMap.set(empKey, Number(l.total_accumulated_pf) || 0);
            }
          }
        } catch (lErr) {
          console.warn("PFLedger find error in getSuperAdminPayroll:", lErr.message);
        }
      }

      if (isModelQueryable(Payroll)) {
        try {
          const allPaidPayrolls = await Payroll.find({ employeeId: { $in: activeEmpIds }, status: "Paid" });
          if (Array.isArray(allPaidPayrolls)) {
            // Sort descending by paymentDate / createdAt for live lock checks
            const sortedPaid = [...allPaidPayrolls].sort((a, b) => {
              const tA = new Date(a.paymentDate || a.createdAt || 0).getTime();
              const tB = new Date(b.paymentDate || b.createdAt || 0).getTime();
              return tB - tA;
            });
            for (const p of sortedPaid) {
              allPaidPayrollsList.push(p);
              const empKey = String(p.employeeId?._id || p.employeeId);
              const current = paidPayrollsSumMap.get(empKey) || 0;
              paidPayrollsSumMap.set(empKey, current + (Number(p.pf_amount) || 0));

              if (!mostRecentPayrollMap.has(empKey)) {
                mostRecentPayrollMap.set(empKey, p);
              }
            }
          }
        } catch (pErr) {
          console.warn("Payroll find error for total PF in getSuperAdminPayroll:", pErr.message);
        }
      }
    }

    const records = employees.map((emp) => {
      const u = emp.user_id || {};
      const org = emp.organizationId || {};
      const dept = emp.department_id || {};

      const monthSalary = emp.month_salary || 50000;
      const yearlySalary = monthSalary * 12;
      const pfPercentage = emp.pf_percentage !== undefined ? emp.pf_percentage : 12;
      const pfAmount = Math.round((monthSalary * pfPercentage) / 100);
      const netSalary = monthSalary - pfAmount;

      // Cumulative Total PF per employee across entire employment so far
      const empKey = String(emp._id);
      const ledgerAccumulated = ledgerMap.get(empKey);
      const payrollAccumulated = paidPayrollsSumMap.get(empKey) || 0;
      const totalAccumulatedPf = (ledgerAccumulated !== undefined && ledgerAccumulated !== null && ledgerAccumulated > 0)
        ? ledgerAccumulated
        : (payrollAccumulated || (ledgerAccumulated !== undefined && ledgerAccumulated !== null ? ledgerAccumulated : 0));

      // Find current month's payroll record
      const currentMonthPayroll = (allPaidPayrollsList.length > 0 ? allPaidPayrollsList : (yearPayrolls || [])).find(
        (p) => String(p.employeeId?._id || p.employeeId) === String(emp._id) &&
               Number(p.month) === Number(selectedMonth) &&
               Number(p.year) === Number(selectedYear)
      );
      const isPaidThisMonth = !!currentMonthPayroll;

      // 30-day pay lock calculation:
      // Computed LIVE solely from the Payroll collection (Employee.last_payment_date is NOT used).
      // If a payroll record is deleted, lock status immediately recalculates and unlocks.
      const mostRecentPaidPayroll = mostRecentPayrollMap.get(empKey) || null;
      let isPayLocked = false;
      let payLockRemainingDays = 0;
      let payLockText = "Pay";

      if (mostRecentPaidPayroll) {
        const paymentTime = new Date(mostRecentPaidPayroll.paymentDate || mostRecentPaidPayroll.createdAt).getTime();
        const diffMs = Date.now() - paymentTime;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // 30-day lock window: locked for days 0-29 (diffDays < 30); unlocks on day 31 (diffDays >= 30)
        if (diffDays < 30 && diffDays >= 0) {
          isPayLocked = true;
          payLockRemainingDays = 30 - diffDays;
          payLockText = `Paid (Locked: ${payLockRemainingDays} ${payLockRemainingDays === 1 ? "day" : "days"})`;
        }
      }

      if (isPaidThisMonth) {
        isPayLocked = true;
        if (payLockRemainingDays <= 0) {
          payLockText = "Paid";
        }
      }

      const status = isPayLocked ? "Sending" : "Pending";

      // Calculate total paid in this year
      const empYearPayrolls = (allPaidPayrollsList.length > 0 ? allPaidPayrollsList : (yearPayrolls || []))
        .filter((p) => String(p.employeeId?._id || p.employeeId) === String(emp._id) && Number(p.year) === Number(selectedYear));
      const totalPaidThisYear = empYearPayrolls.reduce((sum, p) => sum + (p.netSalary || monthSalary), 0);
      const remainingSalary = Math.max(0, yearlySalary - totalPaidThisYear);

      // Bonus progress counter:
      // If the current viewed month's payroll has an auto-credited bonus, it reached 12/12.
      // Otherwise, reflect the employee's live bonus_months_count (0-11).
      let bonusProgressCount = typeof emp.bonus_months_count === "number" ? emp.bonus_months_count : 0;
      if (currentMonthPayroll && Number(currentMonthPayroll.bonus) > 0) {
        bonusProgressCount = 12;
      }

      // Bonus Cooldown
      const bonusCooldown = calculateBonusCooldown(emp.last_bonus_date);
      const accountNumber = formatAccountNumber(emp.bank_account_number || emp.account_number, u.phone);

      return {
        _id: emp._id,
        userId: u._id,
        employeeCode: emp.employee_code || "EMP---",
        name: u.name || "Unnamed Staff",
        email: u.email || "",
        phone: u.phone || "",
        role: u.role || "Employee",
        designation: emp.designation || "Staff",
        department: dept.name || u.department || "General",
        organizationName: org.name || "Infinetra Technologies",
        organizationId: org._id,
        accountNumber,
        rawAccountNumber: emp.bank_account_number || emp.account_number || "XXXX6787",
        bankAccountNumber: emp.bank_account_number || emp.account_number || "",
        hasBankAccount: Boolean(getCleanAccountNumber(emp)),
        ifscCode: emp.ifsc_code || "HDFC0001234",
        bankName: emp.bank_name || "HDFC Bank",
        branch: emp.branch || "Main Branch",
        upiId: emp.upi_id || "",
        monthSalary,
        yearlySalary,
        pfPercentage,
        pfAmount,
        total_pf: totalAccumulatedPf,
        totalPf: totalAccumulatedPf,
        totalAccumulatedPf,
        netSalary,
        remainingSalary,
        totalPaidThisYear,
        monthsPaidCount: bonusProgressCount,
        bonusProgressCount,
        paidCountThisYear: bonusProgressCount,
        status,
        isPayLocked,
        payLockRemainingDays,
        payLockText,
        lastPaymentDate: mostRecentPaidPayroll?.paymentDate || emp.last_payment_date || null,
        lastBonusDate: emp.last_bonus_date || null,
        isBonusEligible: bonusCooldown.isBonusEligible,
        bonusCooldownMonths: bonusCooldown.remainingMonths,
        bonusCooldownText: bonusCooldown.cooldownText,
        bonusAmount: monthSalary, // Default bonus is 1 month salary
      };
    });

    const canRunAggregate = (model) => {
      if (mongoose.connection?.readyState === 1) return true;
      if (typeof model?.aggregate === "function" && model.aggregate !== mongoose.Model.aggregate) return true;
      return false;
    };

    // 1. Current Month's PF: Sum of pf_amount across all employees' CURRENT month payroll records (table rows)
    let current_month_total_pf = 0;
    try {
      if (canRunAggregate(Employee)) {
        const saUsers = await User.find({ role: { $in: [/^super_?admin$/i] } }).select("_id");
        const saUserIds = saUsers.map((u) => u._id);
        const pfEmpMatch = { ...empFilter };
        if (saUserIds.length > 0) {
          pfEmpMatch.user_id = { $nin: saUserIds };
        }

        const currentMonthPfAgg = await Employee.aggregate([
          { $match: pfEmpMatch },
          {
            $project: {
              pf_amount: {
                $round: [
                  {
                    $divide: [
                      {
                        $multiply: [
                          { $ifNull: ["$month_salary", 50000] },
                          { $ifNull: ["$pf_percentage", 12] },
                        ],
                      },
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$pf_amount" },
            },
          },
        ]);
        if (currentMonthPfAgg?.length > 0 && currentMonthPfAgg[0].total !== undefined) {
          current_month_total_pf = currentMonthPfAgg[0].total;
        } else {
          current_month_total_pf = records.reduce((sum, r) => sum + (r.pfAmount || 0), 0);
        }
      } else {
        current_month_total_pf = records.reduce((sum, r) => sum + (r.pfAmount || 0), 0);
      }
    } catch (aggErr) {
      current_month_total_pf = records.reduce((sum, r) => sum + (r.pfAmount || 0), 0);
    }

    // 2. Total Accumulated PF (Active Employees): sum of PFLedger.total_accumulated_pf across all currently active employees
    let total_accumulated_pf_active = 0;
    try {
      const activeEmpObjectIds = employees
        .map((e) => e._id)
        .filter(Boolean)
        .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id));

      if (activeEmpObjectIds.length > 0 && canRunAggregate(PFLedger)) {
        const ledgerMatch = {
          employee_id: { $in: activeEmpObjectIds },
        };
        if (organizationId) {
          ledgerMatch.organizationId = scopedOrgId;
        }

        const activePfAgg = await PFLedger.aggregate([
          { $match: ledgerMatch },
          {
            $group: {
              _id: null,
              total: { $sum: "$total_accumulated_pf" },
            },
          },
        ]);
        if (activePfAgg?.length > 0 && activePfAgg[0].total !== undefined) {
          total_accumulated_pf_active = activePfAgg[0].total;
        }
      }
    } catch (ledgerAggErr) {
      console.warn("total_accumulated_pf_active error:", ledgerAggErr.message);
    }

    // 3. Total PF Settled (Offboarded Employees): sum of pf_settlement_amount across all completed offboardings
    let total_pf_settled_offboarded = 0;
    try {
      if (canRunAggregate(OffboardingProcess)) {
        const settledPfMatch = {
          status: "Completed",
        };
        if (organizationId) {
          settledPfMatch.organizationId = scopedOrgId;
        }

        const settledPfAgg = await OffboardingProcess.aggregate([
          { $match: settledPfMatch },
          {
            $group: {
              _id: null,
              total: { $sum: "$pf_settlement_amount" },
            },
          },
        ]);
        if (settledPfAgg?.length > 0 && settledPfAgg[0].total !== undefined) {
          total_pf_settled_offboarded = settledPfAgg[0].total;
        } else {
          total_pf_settled_offboarded = completedOffboardings.reduce(
            (sum, off) => sum + (off.pf_settlement_amount || 0),
            0
          );
        }
      } else {
        total_pf_settled_offboarded = completedOffboardings.reduce(
          (sum, off) => sum + (off.pf_settlement_amount || 0),
          0
        );
      }
    } catch (settledAggErr) {
      console.warn("total_pf_settled_offboarded error:", settledAggErr.message);
      total_pf_settled_offboarded = completedOffboardings.reduce(
        (sum, off) => sum + (off.pf_settlement_amount || 0),
        0
      );
    }

    // Optional: Fetch all organizations list
    let organizations = [];
    try {
      organizations = await Organization.find({}).select("_id name").lean();
    } catch (e) {}

    // Calculate summary statistics
    const totalSendingAmount = records
      .filter((r) => r.status === "Pending")
      .reduce((sum, r) => sum + r.monthSalary, 0);

    const totalPaidAmount = records
      .filter((r) => r.status === "Sending")
      .reduce((sum, r) => sum + r.monthSalary, 0);

    return res.status(200).json({
      success: true,
      selectedMonth,
      selectedYear,
      selectedOrganizationId: organizationId || "all",
      monthName: MONTH_NAMES[selectedMonth] || "Current Month",
      totalSendingAmount,
      totalPaidAmount,
      totalEmployees: records.length,
      pendingCount: records.filter((r) => r.status === "Pending").length,
      sentCount: records.filter((r) => r.status === "Sending").length,
      sendingCount: records.filter((r) => r.status === "Sending").length,
      current_month_total_pf,
      total_accumulated_pf_active,
      total_pf_settled_offboarded,
      pfSummary: {
        current_month_total_pf,
        total_accumulated_pf_active,
        total_pf_settled_offboarded,
      },
      organizations: organizations || [],
      records,
    });
  } catch (err) {
    console.error("getSuperAdminPayroll error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/super-admin/payroll/pay-single ─────────────────────────────────
export const paySingleSalary = async (req, res) => {
  try {
    const { employeeId, month, year, customAmount, customAccountNumber } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const monthName = MONTH_NAMES[targetMonth] || `Month ${targetMonth}`;

    const emp = await Employee.findById(employeeId)
      .populate("user_id", "name email role phone")
      .populate("organizationId", "name");

    if (!emp) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    if (emp.employment_status === "Inactive") {
      return res.status(400).json({ success: false, message: "Cannot process salary for an inactive/relieved employee." });
    }

    const u = emp.user_id || {};
    const org = emp.organizationId || {};
    const organizationName = org.name || "Infinetra Technologies";
    const amount = Number(customAmount || req.body.amount) || emp.month_salary || 50000;
    const pfPercentage = emp.pf_percentage !== undefined ? emp.pf_percentage : 12;
    const pfAmount = Math.round((amount * pfPercentage) / 100);
    const netPaidAmount = amount - pfAmount;

    const cleanAcc = getCleanAccountNumber(emp);
    const maskedAcc = cleanAcc ? `XXXX${cleanAcc.slice(-4)}` : "";
    const accSnippet = maskedAcc ? `, Account No. ${maskedAcc}` : "";
    const accountNumber = formatAccountNumber(customAccountNumber || req.body.accountNumber || emp.bank_account_number || emp.account_number, u.phone);

    // FIX 2: Bonus progress counter and 12/12 auto-credit logic
    const currentBonusCount = typeof emp.bonus_months_count === "number" ? emp.bonus_months_count : 0;
    const newBonusCount = currentBonusCount + 1;
    let autoBonusAmount = 0;
    let isAutoBonusPaid = false;

    if (newBonusCount >= 12) {
      isAutoBonusPaid = true;
      autoBonusAmount = emp.month_salary || amount || 50000;
    }

    const finalGrossSalary = amount + autoBonusAmount;
    const finalNetSalary = netPaidAmount + autoBonusAmount;

    // Update or create payroll record
    let payroll = await Payroll.findOne({
      employeeId: emp._id,
      month: targetMonth,
      year: targetYear,
    });

    const transactionRef = `TXN-SAL-${targetYear}${String(targetMonth).padStart(2, "0")}-${Date.now().toString().slice(-6)}`;

    if (!payroll) {
      payroll = new Payroll({
        employeeId: emp._id,
        month: targetMonth,
        year: targetYear,
        basicSalary: amount,
        bonus: autoBonusAmount,
        grossSalary: finalGrossSalary,
        pf_percentage: pfPercentage,
        pf_amount: pfAmount,
        netSalary: finalNetSalary,
        daysPresent: 30,
        totalWorkingDays: 30,
        status: "Paid",
        paymentDate: new Date(),
        accountNumber: maskedAcc || accountNumber,
        generatedBy: mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null,
        employeeSnapshot: {
          employeeCode: emp.employee_code,
          fullName: u.name,
          designation: emp.designation,
          department: u.department,
        },
      });
    } else {
      payroll.status = "Paid";
      payroll.paymentDate = new Date();
      payroll.basicSalary = amount;
      payroll.bonus = autoBonusAmount;
      payroll.grossSalary = finalGrossSalary;
      payroll.pf_percentage = pfPercentage;
      payroll.pf_amount = pfAmount;
      payroll.netSalary = finalNetSalary;
      payroll.accountNumber = maskedAcc || accountNumber;
    }

    await payroll.save();

    emp.last_payment_date = new Date();

    if (isAutoBonusPaid) {
      emp.last_bonus_date = new Date();
      if (!emp.bonus_history) emp.bonus_history = [];
      const bonusTxnRef = `TXN-AUTO-BNS-${targetYear}${String(targetMonth).padStart(2, "0")}-${Date.now().toString().slice(-6)}`;
      emp.bonus_history.push({
        amount: autoBonusAmount,
        paidAt: new Date(),
        transactionRef: bonusTxnRef,
        note: "Annual Bonus (Auto-credited at 12/12 salary payment)",
      });
      // Reset counter to 0 immediately upon auto-payment
      // so the very next month's salary payment increments to 1/12
      emp.bonus_months_count = 0;
    } else {
      emp.bonus_months_count = newBonusCount;
    }

    await emp.save();

    // Update PFLedger
    const orgId = emp.organizationId?._id || emp.organizationId;
    if (orgId) {
      await PFLedger.findOneAndUpdate(
        { employee_id: emp._id, organizationId: orgId },
        {
          $inc: { total_accumulated_pf: pfAmount },
          $set: { last_pf_contribution: pfAmount, last_updated: new Date() },
          $push: {
            history: {
              month: targetMonth,
              year: targetYear,
              amount: pfAmount,
              payroll_id: payroll._id,
              date: new Date(),
            },
          },
        },
        { upsert: true, new: true }
      );
    }

    // 1. Create In-App Notification for employee
    const notifMessage = `Credited: Monthly salary from ${organizationName}${accSnippet}. Amount credited: ₹${finalNetSalary.toLocaleString("en-IN")} (Monthly salary ₹${amount.toLocaleString("en-IN")}${isAutoBonusPaid ? ` + Annual Bonus ₹${autoBonusAmount.toLocaleString("en-IN")}` : ""} minus PF ₹${pfAmount.toLocaleString("en-IN")}). PF contribution for this month: ₹${pfAmount.toLocaleString("en-IN")}.`;

    if (u._id) {
      await createNotification({
        recipient: u._id,
        type: "payroll",
        message: notifMessage,
        skipEmail: true,
      });
    }

    // Auto-credit bonus notification
    if (isAutoBonusPaid && u._id) {
      const bonusNotifMessage = `Your annual bonus of ₹${autoBonusAmount.toLocaleString("en-IN")} has been credited along with your ${monthName} ${targetYear} salary.`;
      await createNotification({
        recipient: u._id,
        type: "bonus",
        message: bonusNotifMessage,
        skipEmail: true,
      });

      try {
        await sendBonusCreditedEmail({
          to: u.email,
          employeeName: u.name,
          employeeRole: u.role,
          employeeCode: emp.employee_code,
          organizationName,
          accountNumber: maskedAcc || accountNumber,
          amount: autoBonusAmount,
          transactionRef: `TXN-AUTO-BNS-${Date.now().toString().slice(-6)}`,
        });
      } catch (mailErr) {
        console.error("Auto bonus email error in paySingleSalary:", mailErr.message);
      }
    }

    // Also notify Super Admin so notification appears in Super Admin bell
    try {
      const superAdminUser =
        (await User.findOne({ email: (process.env.SUPER_ADMIN_EMAIL || "super@gmail.com").trim().toLowerCase() })) ||
        (await User.findOne({ role: "SUPER_ADMIN" }));
      const adminRecipient = req.user?.id || req.user?._id || superAdminUser?._id;
      if (adminRecipient && String(adminRecipient) !== String(u._id)) {
        await createNotification({
          recipient: adminRecipient,
          type: "payroll",
          message: `Salary credited to ${u.name || "Employee"}${accSnippet}: Net ₹${finalNetSalary.toLocaleString("en-IN")}${isAutoBonusPaid ? ` (incl. ₹${autoBonusAmount.toLocaleString("en-IN")} bonus)` : ""} (PF ₹${pfAmount.toLocaleString("en-IN")}) by ${organizationName}.`,
        });
      }
    } catch (notifAdminErr) {
      console.error("Super Admin notif error:", notifAdminErr.message);
    }

    // 2. Send email via Nodemailer
    await sendSalaryCreditedEmail({
      to: u.email,
      employeeName: u.name || "Employee",
      employeeRole: u.role || "Staff",
      employeeCode: emp.employee_code || "EMP---",
      organizationName,
      accountNumber: maskedAcc || accountNumber,
      amount: finalNetSalary,
      monthSalary: amount,
      pfAmount,
      monthName,
      year: targetYear,
      transactionRef,
    });

    return res.status(200).json({
      success: true,
      message: isAutoBonusPaid
        ? `Salary of ₹${finalNetSalary.toLocaleString("en-IN")} (including ₹${autoBonusAmount.toLocaleString("en-IN")} annual bonus, PF ₹${pfAmount.toLocaleString("en-IN")}) credited to ${u.name} successfully.`
        : `Salary of ₹${netPaidAmount.toLocaleString("en-IN")} (PF ₹${pfAmount.toLocaleString("en-IN")}) credited to ${u.name} successfully.`,
      payroll,
      pfAmount,
      netPaidAmount: finalNetSalary,
      hasBankAccount: Boolean(cleanAcc),
      transactionRef,
      isAutoBonusPaid,
      autoBonusAmount,
    });
  } catch (err) {
    console.error("paySingleSalary error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/super-admin/payroll/pay-bonus ──────────────────────────────────
export const payBonus = async (req, res) => {
  try {
    const { employeeId, customBonusAmount } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    const emp = await Employee.findById(employeeId)
      .populate("user_id", "name email role phone")
      .populate("organizationId", "name");

    if (!emp) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    if (emp.employment_status === "Inactive") {
      return res.status(400).json({ success: false, message: "Cannot process bonus for an inactive/relieved employee." });
    }

    // 12-Month Cooldown Check
    const cooldown = calculateBonusCooldown(emp.last_bonus_date);
    if (!cooldown.isBonusEligible) {
      return res.status(400).json({
        success: false,
        message: `Bonus already paid within the last 12 months. Next bonus available in ${cooldown.remainingMonths} ${cooldown.remainingMonths === 1 ? "month" : "months"}.`,
        remainingMonths: cooldown.remainingMonths,
      });
    }

    const u = emp.user_id || {};
    const org = emp.organizationId || {};
    const organizationName = org.name || "Infinetra Technologies";
    const amount = Number(customBonusAmount || req.body.amount) || emp.month_salary || 50000;
    const accountNumber = formatAccountNumber(emp.account_number, u.phone);
    const transactionRef = `TXN-BNS-${Date.now().toString().slice(-8)}`;

    // Update bonus date and history
    emp.last_bonus_date = new Date();
    if (!emp.bonus_history) emp.bonus_history = [];
    emp.bonus_history.push({
      amount,
      paidAt: new Date(),
      transactionRef,
      note: "Annual Bonus paid by Super Admin",
    });

    await emp.save();

    // 1. Create In-App Notification for employee
    const notifMessage = `Annual bonus of ₹${amount.toLocaleString("en-IN")} has been credited to your account ${accountNumber} by ${organizationName}.`;

    if (u._id) {
      await createNotification({
        recipient: u._id,
        type: "bonus",
        message: notifMessage,
        skipEmail: true,
      });
    }

    // Also notify Super Admin
    try {
      const superAdminUser =
        (await User.findOne({ email: (process.env.SUPER_ADMIN_EMAIL || "super@gmail.com").trim().toLowerCase() })) ||
        (await User.findOne({ role: "SUPER_ADMIN" }));
      const adminRecipient = req.user?.id || req.user?._id || superAdminUser?._id;
      if (adminRecipient && String(adminRecipient) !== String(u._id)) {
        await createNotification({
          recipient: adminRecipient,
          type: "bonus",
          message: `Annual bonus of ₹${amount.toLocaleString("en-IN")} has been credited to ${u.name || "Employee"} (${accountNumber}) by ${organizationName}. (12-month lock active)`,
        });
      }
    } catch (notifAdminErr) {
      console.error("Super Admin bonus notif error:", notifAdminErr.message);
    }

    // 2. Send email via Nodemailer
    await sendBonusCreditedEmail({
      to: u.email,
      employeeName: u.name || "Employee",
      employeeRole: u.role || "Staff",
      employeeCode: emp.employee_code || "EMP---",
      organizationName,
      accountNumber,
      amount,
      transactionRef,
    });

    return res.status(200).json({
      success: true,
      message: `Annual bonus of ₹${amount.toLocaleString("en-IN")} credited to ${u.name} successfully. Bonus locked for 12 months.`,
      lastBonusDate: emp.last_bonus_date,
      cooldownMonths: 12,
      cooldownText: "Locked (Active in 12 months)",
      transactionRef,
    });
  } catch (err) {
    console.error("payBonus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/super-admin/payroll/pay-all ────────────────────────────────────
export const payAllSalaries = async (req, res) => {
  try {
    const targetMonth = parseInt(req.body.month) || new Date().getMonth() + 1;
    const targetYear = parseInt(req.body.year) || new Date().getFullYear();
    const monthName = MONTH_NAMES[targetMonth] || `Month ${targetMonth}`;

    const completedOffboardings = await OffboardingProcess.find({ status: "Completed" }).select("employee_id completed_at updatedAt");
    const offboardedEmpIds = new Set();
    for (const off of completedOffboardings) {
      const empId = String(off.employee_id?._id || off.employee_id);
      if (!empId) continue;
      const newerOnboard = await OnboardingProcess.findOne({
        employee_id: off.employee_id,
        status: "Completed",
        createdAt: { $gt: off.completed_at || off.updatedAt },
      });
      if (!newerOnboard) {
        offboardedEmpIds.add(empId);
      }
    }

    const empFilter = { employment_status: "Active" };
    if (offboardedEmpIds.size > 0) {
      empFilter._id = { $nin: Array.from(offboardedEmpIds) };
    }

    const allEmployees = await Employee.find(empFilter)
      .populate("user_id", "name email role phone department")
      .populate("organizationId", "name");

    const employees = allEmployees.filter((e) => {
      const userRole = (e.user_id?.role || "").toUpperCase();
      return userRole !== "SUPER_ADMIN" && userRole !== "SUPERADMIN";
    });

    // Find who is already paid
    const existingPaid = await Payroll.find({
      month: targetMonth,
      year: targetYear,
      status: "Paid",
    });
    const paidEmployeeIds = new Set(existingPaid.map((p) => String(p.employeeId)));

    const pendingEmployees = employees.filter((e) => !paidEmployeeIds.has(String(e._id)));

    if (pendingEmployees.length === 0) {
      return res.status(200).json({
        success: true,
        message: `All employees have already been paid for ${monthName} ${targetYear}.`,
        paidCount: 0,
        totalAmount: 0,
      });
    }

    let totalAmount = 0;
    const processed = [];

    for (const emp of pendingEmployees) {
      const u = emp.user_id || {};
      const org = emp.organizationId || {};
      const organizationName = org.name || "Infinetra Technologies";
      const amount = emp.month_salary || 50000;
      const pfPercentage = emp.pf_percentage !== undefined ? emp.pf_percentage : 12;
      const pfAmount = Math.round((amount * pfPercentage) / 100);
      const netPaidAmount = amount - pfAmount;

      const cleanAcc = getCleanAccountNumber(emp);
      const maskedAcc = cleanAcc ? `XXXX${cleanAcc.slice(-4)}` : "";
      const accSnippet = maskedAcc ? `, Account No. ${maskedAcc}` : "";
      const accountNumber = formatAccountNumber(emp.bank_account_number || emp.account_number, u.phone);
      const transactionRef = `TXN-BULK-${targetYear}${String(targetMonth).padStart(2, "0")}-${Date.now().toString().slice(-6)}`;

      // FIX 2: Bonus progress counter and 12/12 auto-credit logic
      const currentBonusCount = typeof emp.bonus_months_count === "number" ? emp.bonus_months_count : 0;
      const newBonusCount = currentBonusCount + 1;
      let autoBonusAmount = 0;
      let isAutoBonusPaid = false;

      if (newBonusCount >= 12) {
        isAutoBonusPaid = true;
        autoBonusAmount = emp.month_salary || amount || 50000;
      }

      const finalGrossSalary = amount + autoBonusAmount;
      const finalNetSalary = netPaidAmount + autoBonusAmount;

      let payroll = await Payroll.findOne({
        employeeId: emp._id,
        month: targetMonth,
        year: targetYear,
      });

      if (!payroll) {
        payroll = new Payroll({
          employeeId: emp._id,
          month: targetMonth,
          year: targetYear,
          basicSalary: amount,
          bonus: autoBonusAmount,
          grossSalary: finalGrossSalary,
          pf_percentage: pfPercentage,
          pf_amount: pfAmount,
          netSalary: finalNetSalary,
          daysPresent: 30,
          totalWorkingDays: 30,
          status: "Paid",
          paymentDate: new Date(),
          accountNumber: maskedAcc || accountNumber,
          generatedBy: mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null,
          employeeSnapshot: {
            employeeCode: emp.employee_code,
            fullName: u.name,
            designation: emp.designation,
            department: u.department,
          },
        });
      } else {
        payroll.status = "Paid";
        payroll.paymentDate = new Date();
        payroll.basicSalary = amount;
        payroll.bonus = autoBonusAmount;
        payroll.grossSalary = finalGrossSalary;
        payroll.pf_percentage = pfPercentage;
        payroll.pf_amount = pfAmount;
        payroll.netSalary = finalNetSalary;
        payroll.accountNumber = maskedAcc || accountNumber;
      }

      await payroll.save();

      emp.last_payment_date = new Date();

      if (isAutoBonusPaid) {
        emp.last_bonus_date = new Date();
        if (!emp.bonus_history) emp.bonus_history = [];
        const bonusTxnRef = `TXN-AUTO-BNS-${targetYear}${String(targetMonth).padStart(2, "0")}-${Date.now().toString().slice(-6)}`;
        emp.bonus_history.push({
          amount: autoBonusAmount,
          paidAt: new Date(),
          transactionRef: bonusTxnRef,
          note: "Annual Bonus (Auto-credited at 12/12 salary payment)",
        });
        emp.bonus_months_count = 0;
      } else {
        emp.bonus_months_count = newBonusCount;
      }

      await emp.save();

      // Update PFLedger
      const orgId = emp.organizationId?._id || emp.organizationId;
      if (orgId) {
        await PFLedger.findOneAndUpdate(
          { employee_id: emp._id, organizationId: orgId },
          {
            $inc: { total_accumulated_pf: pfAmount },
            $set: { last_pf_contribution: pfAmount, last_updated: new Date() },
            $push: {
              history: {
                month: targetMonth,
                year: targetYear,
                amount: pfAmount,
                payroll_id: payroll._id,
                date: new Date(),
              },
            },
          },
          { upsert: true, new: true }
        );
      }

      totalAmount += finalNetSalary;
      processed.push({ name: u.name, amount: finalNetSalary, pfAmount, email: u.email });

      // In-App Notification
      const notifMessage = `Credited: Monthly salary from ${organizationName}${accSnippet}. Amount credited: ₹${finalNetSalary.toLocaleString("en-IN")} (Monthly salary ₹${amount.toLocaleString("en-IN")}${isAutoBonusPaid ? ` + Annual Bonus ₹${autoBonusAmount.toLocaleString("en-IN")}` : ""} minus PF ₹${pfAmount.toLocaleString("en-IN")}). PF contribution for this month: ₹${pfAmount.toLocaleString("en-IN")}.`;

      if (u._id) {
        await createNotification({
          recipient: u._id,
          type: "payroll",
          message: notifMessage,
          skipEmail: true,
        });
      }

      // Auto-credit bonus notification
      if (isAutoBonusPaid && u._id) {
        const bonusNotifMessage = `Your annual bonus of ₹${autoBonusAmount.toLocaleString("en-IN")} has been credited along with your ${monthName} ${targetYear} salary.`;
        await createNotification({
          recipient: u._id,
          type: "bonus",
          message: bonusNotifMessage,
          skipEmail: true,
        });

        try {
          await sendBonusCreditedEmail({
            to: u.email,
            employeeName: u.name,
            employeeRole: u.role,
            employeeCode: emp.employee_code,
            organizationName,
            accountNumber: maskedAcc || accountNumber,
            amount: autoBonusAmount,
            transactionRef: `TXN-AUTO-BNS-${Date.now().toString().slice(-6)}`,
          });
        } catch (mailErr) {
          console.error("Auto bonus email error in payAllSalaries:", mailErr.message);
        }
      }

      // Email
      await sendSalaryCreditedEmail({
        to: u.email,
        employeeName: u.name || "Employee",
        employeeRole: u.role || "Staff",
        employeeCode: emp.employee_code || "EMP---",
        organizationName,
        accountNumber: maskedAcc || accountNumber,
        amount: finalNetSalary,
        monthSalary: amount,
        pfAmount,
        monthName,
        year: targetYear,
        transactionRef,
      });
    }

    // Consolidated email to Super Admin and process.env.EMAIL
    const superAdminRecipients = new Set();
    if (process.env.EMAIL && String(process.env.EMAIL).trim()) {
      superAdminRecipients.add(String(process.env.EMAIL).trim().toLowerCase());
    }
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "super@gmail.com").trim().toLowerCase();
    if (superAdminEmail) {
      superAdminRecipients.add(superAdminEmail);
    }

    for (const admEmail of superAdminRecipients) {
      try {
        await sendEmail({
          to: admEmail,
          subject: `[HRMS] Bulk Salary Payout Completed — ${monthName} ${targetYear}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h2 style="color: #16a34a; margin-top: 0;">Bulk Salary Payout Successful</h2>
              <p>Total of <strong>${processed.length} employees/HR</strong> were paid for <strong>${monthName} ${targetYear}</strong>.</p>
              <p><strong>Total Net Dispatched:</strong> <span style="color: #16a34a; font-size: 18px; font-weight: bold;">₹${totalAmount.toLocaleString("en-IN")}/-</span></p>
              <ul style="margin-top: 14px; line-height: 1.6;">
                ${processed.map((p) => `<li><strong>${p.name}:</strong> ₹${p.amount.toLocaleString("en-IN")} (PF: ₹${(p.pfAmount || 0).toLocaleString("en-IN")}) (${p.email})</li>`).join("")}
              </ul>
            </div>
          `,
        });
      } catch (e) {
        console.error("Bulk email error:", e.message);
      }
    }

    // In-App Notification for Super Admin
    try {
      const superAdminUser =
        (await User.findOne({ email: (process.env.SUPER_ADMIN_EMAIL || "super@gmail.com").trim().toLowerCase() })) ||
        (await User.findOne({ role: "SUPER_ADMIN" }));
      const adminRecipient = req.user?.id || req.user?._id || superAdminUser?._id;
      if (adminRecipient) {
        await createNotification({
          recipient: adminRecipient,
          type: "payroll",
          message: `Batch salary payout completed: ₹${totalAmount.toLocaleString("en-IN")} credited to ${processed.length} employees for ${monthName} ${targetYear}.`,
        });
      }
    } catch (notifErr) {
      console.error("Super admin bulk notif error:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully processed payroll for ${processed.length} employee(s). Total dispatched: ₹${totalAmount.toLocaleString("en-IN")}/-`,
      paidCount: processed.length,
      totalAmount,
      processed,
    });
  } catch (err) {
    console.error("payAllSalaries error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/super-admin/payroll/config/:employeeId ──────────────────────────
export const updateEmployeePayrollConfig = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const {
      monthSalary,
      month_salary,
      pfPercentage,
      pf_percentage,
      bankAccountNumber,
      bank_account_number,
      accountNumber,
      account_number,
      ifscCode,
      ifsc_code,
      bankName,
      bank_name,
      branch,
      upiId,
      upi_id,
    } = req.body;

    const emp = await Employee.findById(employeeId);
    if (!emp) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const newSalary = monthSalary !== undefined ? monthSalary : month_salary;
    if (newSalary !== undefined && !isNaN(Number(newSalary))) {
      emp.month_salary = Number(newSalary);
    }

    const newPf = pfPercentage !== undefined ? pfPercentage : pf_percentage;
    if (newPf !== undefined && !isNaN(Number(newPf))) {
      emp.pf_percentage = Math.max(0, Math.min(100, Number(newPf)));
    }

    const newBankAcc = bankAccountNumber !== undefined ? bankAccountNumber : bank_account_number;
    if (newBankAcc !== undefined) {
      emp.bank_account_number = String(newBankAcc).trim();
      emp.account_number = String(newBankAcc).trim();
    } else {
      const newAcc = accountNumber !== undefined ? accountNumber : account_number;
      if (newAcc !== undefined) {
        emp.account_number = String(newAcc).trim();
        emp.bank_account_number = String(newAcc).trim();
      }
    }

    const newIfsc = ifscCode !== undefined ? ifscCode : ifsc_code;
    if (newIfsc !== undefined) emp.ifsc_code = String(newIfsc).trim().toUpperCase();

    const newBank = bankName !== undefined ? bankName : bank_name;
    if (newBank !== undefined) emp.bank_name = String(newBank).trim();

    if (branch !== undefined) emp.branch = String(branch).trim();

    const newUpi = upiId !== undefined ? upiId : upi_id;
    if (newUpi !== undefined) emp.upi_id = String(newUpi).trim();

    await emp.save();

    return res.status(200).json({
      success: true,
      message: "Employee payroll and banking configuration updated successfully",
      employee: {
        _id: emp._id,
        monthSalary: emp.month_salary,
        yearlySalary: emp.month_salary * 12,
        pfPercentage: emp.pf_percentage !== undefined ? emp.pf_percentage : 12,
        bankAccountNumber: emp.bank_account_number || emp.account_number || "",
        accountNumber: emp.account_number,
        hasBankAccount: Boolean(getCleanAccountNumber(emp)),
        ifscCode: emp.ifsc_code,
        bankName: emp.bank_name,
        branch: emp.branch,
        upiId: emp.upi_id,
      },
    });
  } catch (err) {
    console.error("updateEmployeePayrollConfig error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};