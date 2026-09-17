import { describe, test } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Payroll from "../models/Payroll.js";
import User from "../models/UserModel.js";
import Notification from "../models/Notification.js";
import PFLedger from "../models/PFLedger.js";
import OffboardingProcess from "../models/OffboardingProcess.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import {
  getSuperAdminPayroll,
  paySingleSalary,
  payBonus,
} from "../controllers/superAdminPayrollController.js";
import { calculatePayroll } from "../services/payrollService.js";

// Disable mongoose command buffering and mock unneeded calls during unit tests
mongoose.set("bufferCommands", false);
Payroll.prototype.save = async function () { return this; };
User.findOne = async () => null;
User.find = () => ({ select: async () => [] });
process.env.EMAIL = "";
process.env.EMAIL_PASS = "";

// Helper to create mock express req and res
const createMockReqRes = (query = {}, body = {}, user = { id: new mongoose.Types.ObjectId().toString(), role: "super_admin" }) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    query,
    body,
    params: {},
    user,
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
  return { req, res };
};

describe("FIX 1: Live Pay Button Lock Derivation from Payroll Collection", () => {
  test("1. Paying salary locks button; deleting that payroll record unlocks it immediately (even if Employee.last_payment_date still exists)", async () => {
    const origPayrollFind = Payroll.find;
    const origEmpFind = Employee.find;
    const origOffboardFind = OffboardingProcess.find;
    const origOnboardFindOne = OnboardingProcess.findOne;

    try {
      OffboardingProcess.find = () => ({ select: async () => [] });
      OnboardingProcess.findOne = async () => null;

      const empId = new mongoose.Types.ObjectId();
      const mockEmployee = {
        _id: empId,
        employee_code: "EMP101",
        employment_status: "Active",
        month_salary: 50000,
        pf_percentage: 12,
        last_payment_date: new Date(), // Permanent date still on Employee model!
        bonus_months_count: 1,
        user_id: { _id: new mongoose.Types.ObjectId(), role: "EMPLOYEE", name: "Alice Developer", email: "alice@test.com" },
        organizationId: { _id: new mongoose.Types.ObjectId(), name: "Infinetra Technologies" },
        department_id: { name: "Engineering" },
      };

      Employee.find = () => ({
        populate: () => ({
          populate: () => ({
            populate: async () => [mockEmployee],
          }),
        }),
      });

      // Scenario A: Payroll record exists (paid today)
      let payrollStore = [
        {
          _id: new mongoose.Types.ObjectId(),
          employeeId: empId,
          month: 9,
          year: 2026,
          status: "Paid",
          paymentDate: new Date(),
          basicSalary: 50000,
          grossSalary: 50000,
          netSalary: 44000,
          pf_amount: 6000,
          bonus: 0,
        },
      ];

      Payroll.find = async () => payrollStore;

      // Check lock state when payroll record exists
      const { req: req1, res: res1 } = createMockReqRes({ month: 9, year: 2026 });
      await getSuperAdminPayroll(req1, res1);
      assert.strictEqual(res1.getStatusCode(), 200);
      const data1 = res1.getData();
      assert.strictEqual(data1.records[0].isPayLocked, true, "Button must be locked when payroll record exists");
      assert.strictEqual(data1.records[0].status, "Sending");
      assert.ok(data1.records[0].payLockRemainingDays > 0);

      // Scenario B: Payroll record is DELETED from the database
      payrollStore = []; // simulate deleting the payroll document from MongoDB

      const { req: req2, res: res2 } = createMockReqRes({ month: 9, year: 2026 });
      await getSuperAdminPayroll(req2, res2);
      assert.strictEqual(res2.getStatusCode(), 200);
      const data2 = res2.getData();

      // Lock MUST be unlocked immediately, despite Employee.last_payment_date still holding the old date!
      assert.strictEqual(data2.records[0].isPayLocked, false, "Pay button must unlock immediately when payroll record is deleted");
      assert.strictEqual(data2.records[0].status, "Pending", "Status must return to Pending when payroll record is deleted");
      assert.strictEqual(data2.records[0].payLockText, "Pay");
    } finally {
      Payroll.find = origPayrollFind;
      Employee.find = origEmpFind;
      OffboardingProcess.find = origOffboardFind;
      OnboardingProcess.findOne = origOnboardFindOne;
    }
  });

  test("2. Historical records remain intact; advancing past 30 days unlocks automatically without deleting records", async () => {
    const origPayrollFind = Payroll.find;
    const origEmpFind = Employee.find;
    const origOffboardFind = OffboardingProcess.find;
    const origOnboardFindOne = OnboardingProcess.findOne;

    try {
      OffboardingProcess.find = () => ({ select: async () => [] });
      OnboardingProcess.findOne = async () => null;

      const empId = new mongoose.Types.ObjectId();
      const mockEmployee = {
        _id: empId,
        employee_code: "EMP102",
        employment_status: "Active",
        month_salary: 60000,
        pf_percentage: 12,
        user_id: { _id: new mongoose.Types.ObjectId(), role: "EMPLOYEE", name: "Bob Engineer", email: "bob@test.com" },
        organizationId: { _id: new mongoose.Types.ObjectId(), name: "Infinetra Technologies" },
        department_id: { name: "QA" },
      };

      Employee.find = () => ({
        populate: () => ({
          populate: () => ({
            populate: async () => [mockEmployee],
          }),
        }),
      });

      // 35 days ago (older than 30 days)
      const date35DaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      // Previous month record (Month 8, August) paid 35 days ago
      const historicalPayroll = {
        _id: new mongoose.Types.ObjectId(),
        employeeId: empId,
        month: 8,
        year: 2026,
        status: "Paid",
        paymentDate: date35DaysAgo,
        basicSalary: 60000,
        grossSalary: 60000,
        netSalary: 52800,
        pf_amount: 7200,
        bonus: 0,
      };

      Payroll.find = async () => [historicalPayroll];

      // Viewing next cycle (Month 9, September)
      const { req, res } = createMockReqRes({ month: 9, year: 2026 });
      await getSuperAdminPayroll(req, res);
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();

      // Button is unlocked automatically because last payment was > 30 days ago
      assert.strictEqual(data.records[0].isPayLocked, false, "Must unlock automatically after 30 days without deleting old record");
      assert.strictEqual(data.records[0].status, "Pending");
      assert.strictEqual(data.records[0].payLockText, "Pay");
    } finally {
      Payroll.find = origPayrollFind;
      Employee.find = origEmpFind;
      OffboardingProcess.find = origOffboardFind;
      OnboardingProcess.findOne = origOnboardFindOne;
    }
  });

  test("3. Day 30/31 boundary test (locked up to 29 days 23h, unlocks on day 31 / 30 full days elapsed)", async () => {
    const origPayrollFind = Payroll.find;
    const origEmpFind = Employee.find;
    const origOffboardFind = OffboardingProcess.find;
    const origOnboardFindOne = OnboardingProcess.findOne;

    try {
      OffboardingProcess.find = () => ({ select: async () => [] });
      OnboardingProcess.findOne = async () => null;

      const empId = new mongoose.Types.ObjectId();
      const mockEmployee = {
        _id: empId,
        employee_code: "EMP_B",
        employment_status: "Active",
        month_salary: 50000,
        pf_percentage: 12,
        user_id: { _id: new mongoose.Types.ObjectId(), role: "EMPLOYEE", name: "Boundary Tester", email: "boundary@test.com" },
        organizationId: { _id: new mongoose.Types.ObjectId(), name: "Infinetra Technologies" },
        department_id: { name: "Engineering" },
      };

      Employee.find = () => ({
        populate: () => ({
          populate: () => ({
            populate: async () => [mockEmployee],
          }),
        }),
      });

      // Case A: 29 days and 12 hours ago -> diffDays = 29 (< 30) -> LOCKED
      const date29DaysAgo = new Date(Date.now() - (29.5 * 24 * 60 * 60 * 1000));
      Payroll.find = async () => [
        {
          _id: new mongoose.Types.ObjectId(),
          employeeId: empId,
          month: 8,
          year: 2026,
          status: "Paid",
          paymentDate: date29DaysAgo,
        },
      ];

      const { req: reqA, res: resA } = createMockReqRes({ month: 9, year: 2026 });
      await getSuperAdminPayroll(reqA, resA);
      const dataA = resA.getData();
      assert.strictEqual(dataA.records[0].isPayLocked, true, "Must be locked when diffDays < 30");
      assert.strictEqual(dataA.records[0].payLockRemainingDays, 1, "Remaining days should be 1 on day 29");

      // Case B: 30 days and 1 hour ago -> diffDays = 30 (>= 30, 30 full days passed, day 31) -> UNLOCKED
      const date30DaysAgo = new Date(Date.now() - (30.1 * 24 * 60 * 60 * 1000));
      Payroll.find = async () => [
        {
          _id: new mongoose.Types.ObjectId(),
          employeeId: empId,
          month: 8,
          year: 2026,
          status: "Paid",
          paymentDate: date30DaysAgo,
        },
      ];

      const { req: reqB, res: resB } = createMockReqRes({ month: 9, year: 2026 });
      await getSuperAdminPayroll(reqB, resB);
      const dataB = resB.getData();
      assert.strictEqual(dataB.records[0].isPayLocked, false, "Must unlock on day 31 once 30 full days elapsed");
      assert.strictEqual(dataB.records[0].payLockText, "Pay");
    } finally {
      Payroll.find = origPayrollFind;
      Employee.find = origEmpFind;
      OffboardingProcess.find = origOffboardFind;
      OnboardingProcess.findOne = origOnboardFindOne;
    }
  });
});

describe("FIX 2: 12/12 Auto-Bonus Credit & Next-Month Reset to 1/12", () => {
  test("4. Paying salary increments counter up to 12/12, auto-credits bonus on month 12, sets payroll.bonus and notifications, and resets counter to 0", async () => {
    const origEmpFindById = Employee.findById;
    const origPayrollFindOne = Payroll.findOne;
    const origNotifCreate = Notification.create;
    const origLedgerFindOneAndUpdate = PFLedger.findOneAndUpdate;

    try {
      const empId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const orgId = new mongoose.Types.ObjectId();
      const mockUser = { _id: userId, name: "Charlie Staff", email: "charlie@test.com", role: "Employee", phone: "9876543210" };
      const mockOrg = { _id: orgId, name: "Infinetra Technologies" };

      // Employee currently at 11/12 months paid
      const mockEmp = {
        _id: empId,
        employee_code: "EMP_CH",
        employment_status: "Active",
        month_salary: 50000,
        pf_percentage: 12,
        bonus_months_count: 11,
        bonus_history: [],
        last_bonus_date: null,
        user_id: mockUser,
        organizationId: mockOrg,
        save: async function () { return this; },
      };

      Employee.findById = () => ({
        populate: () => ({
          populate: async () => mockEmp,
        }),
      });

      // No existing payroll for this target month
      Payroll.findOne = async () => null;
      PFLedger.findOneAndUpdate = async () => ({});

      const capturedNotifications = [];
      Notification.create = async (payload) => {
        capturedNotifications.push(payload);
        return payload;
      };

      // Pay month 12 salary
      const { req, res } = createMockReqRes({}, {
        employeeId: empId.toString(),
        month: 12,
        year: 2026,
      });

      await paySingleSalary(req, res);
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();

      // Check auto bonus flag and amounts
      assert.strictEqual(data.isAutoBonusPaid, true, "isAutoBonusPaid must be true on 12th payment");
      assert.strictEqual(data.autoBonusAmount, 50000, "Auto bonus must equal monthly salary (50000)");

      // Check payroll record figures
      assert.strictEqual(data.payroll.bonus, 50000, "payroll.bonus must be 50000");
      assert.strictEqual(data.payroll.basicSalary, 50000);
      // grossSalary = 50000 (basic) + 50000 (bonus) = 100000
      assert.strictEqual(data.payroll.grossSalary, 100000);
      // netSalary = 100000 - 6000 (PF 12%) = 94000
      assert.strictEqual(data.payroll.netSalary, 94000);

      // Check Employee model updates
      assert.strictEqual(mockEmp.bonus_months_count, 0, "Counter must immediately reset to 0 upon auto-payment");
      assert.ok(mockEmp.last_bonus_date instanceof Date, "last_bonus_date must be set");
      assert.strictEqual(mockEmp.bonus_history.length, 1);
      assert.strictEqual(mockEmp.bonus_history[0].amount, 50000);

      // Check Notification text matching exact requirement
      const bonusNotif = capturedNotifications.find((n) => n.type === "bonus");
      assert.ok(bonusNotif, "Bonus notification must be created");
      assert.strictEqual(
        bonusNotif.message,
        "Your annual bonus of ₹50,000 has been credited along with your December 2026 salary."
      );
    } finally {
      Employee.findById = origEmpFindById;
      Payroll.findOne = origPayrollFindOne;
      Notification.create = origNotifCreate;
      PFLedger.findOneAndUpdate = origLedgerFindOneAndUpdate;
    }
  });

  test("5. The month right after auto-payment (Month 13) shows the counter back at 1/12 with no bonus", async () => {
    const origEmpFindById = Employee.findById;
    const origPayrollFindOne = Payroll.findOne;
    const origLedgerFindOneAndUpdate = PFLedger.findOneAndUpdate;

    try {
      const empId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const orgId = new mongoose.Types.ObjectId();
      const mockUser = { _id: userId, name: "Charlie Staff", email: "charlie@test.com", role: "Employee", phone: "9876543210" };
      const mockOrg = { _id: orgId, name: "Infinetra Technologies" };

      // Employee currently reset to 0 after previous auto-payment
      const mockEmp = {
        _id: empId,
        employee_code: "EMP_CH",
        employment_status: "Active",
        month_salary: 50000,
        pf_percentage: 12,
        bonus_months_count: 0, // Reset counter
        bonus_history: [{ amount: 50000, paidAt: new Date() }],
        last_bonus_date: new Date(),
        user_id: mockUser,
        organizationId: mockOrg,
        save: async function () { return this; },
      };

      Employee.findById = () => ({
        populate: () => ({
          populate: async () => mockEmp,
        }),
      });

      Payroll.findOne = async () => null;
      PFLedger.findOneAndUpdate = async () => ({});

      // Pay next month's salary (Month 1, Year 2027)
      const { req, res } = createMockReqRes({}, {
        employeeId: empId.toString(),
        month: 1,
        year: 2027,
      });

      await paySingleSalary(req, res);
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();

      // No bonus in month 13
      assert.strictEqual(data.isAutoBonusPaid, false, "isAutoBonusPaid must be false in month after auto-credit");
      assert.strictEqual(data.payroll.bonus, 0, "payroll.bonus must be 0");
      assert.strictEqual(data.payroll.grossSalary, 50000);
      assert.strictEqual(data.payroll.netSalary, 44000);

      // Counter increments to 1 (representing 1/12)
      assert.strictEqual(mockEmp.bonus_months_count, 1, "Counter must be 1 after month 13 payment (representing 1/12)");
    } finally {
      Employee.findById = origEmpFindById;
      Payroll.findOne = origPayrollFindOne;
      PFLedger.findOneAndUpdate = origLedgerFindOneAndUpdate;
    }
  });

  test("6. Manual 'Pay Bonus' button continues to work independently without disrupting the 12-month salary counter", async () => {
    const origEmpFindById = Employee.findById;
    const origNotifCreate = Notification.create;

    try {
      const empId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const orgId = new mongoose.Types.ObjectId();
      const mockUser = { _id: userId, name: "Diana Analyst", email: "diana@test.com", role: "Employee", phone: "9876543211" };
      const mockOrg = { _id: orgId, name: "Infinetra Technologies" };

      // Employee is at month 5 of their 12-month salary counter
      const mockEmp = {
        _id: empId,
        employee_code: "EMP_DI",
        employment_status: "Active",
        month_salary: 50000,
        bonus_months_count: 5, // 5/12
        bonus_history: [],
        last_bonus_date: null, // Eligible for manual bonus
        user_id: mockUser,
        organizationId: mockOrg,
        save: async function () { return this; },
      };

      Employee.findById = () => ({
        populate: () => ({
          populate: async () => mockEmp,
        }),
      });

      Notification.create = async () => ({});

      // Super admin awards manual ad-hoc bonus of 25000
      const { req, res } = createMockReqRes({}, {
        employeeId: empId.toString(),
        customBonusAmount: 25000,
      });

      await payBonus(req, res);
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();

      assert.strictEqual(data.success, true);

      // Manual bonus was recorded
      assert.strictEqual(mockEmp.bonus_history.length, 1);
      assert.strictEqual(mockEmp.bonus_history[0].amount, 25000);

      // Crucial: The 12-month salary payment counter remains untouched at 5!
      assert.strictEqual(mockEmp.bonus_months_count, 5, "Manual bonus must NOT reset the 12-month regular salary counter");
    } finally {
      Employee.findById = origEmpFindById;
      Notification.create = origNotifCreate;
    }
  });
});

describe("Payslip Safety & Integrity Verification", () => {
  test("7. Payslip figures and calculations: 11 standard months have bonus 0; month 12 reflects bonus correctly", () => {
    // Test standard month
    const standardCalc = calculatePayroll({
      basicSalary: 50000,
      hra: 0,
      allowances: 0,
      deductions: 6000,
      bonus: 0,
      daysPresent: 30,
      totalWorkingDays: 30,
    });
    assert.strictEqual(standardCalc.grossSalary, 50000);
    assert.strictEqual(standardCalc.netSalary, 44000);

    // Test month 12 auto-bonus calculation
    const bonusMonthCalc = calculatePayroll({
      basicSalary: 50000,
      hra: 0,
      allowances: 0,
      deductions: 6000,
      bonus: 50000,
      daysPresent: 30,
      totalWorkingDays: 30,
    });
    assert.strictEqual(bonusMonthCalc.grossSalary, 100000);
    assert.strictEqual(bonusMonthCalc.netSalary, 94000);
  });
});
