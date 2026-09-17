import { describe, test } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import User from "../models/UserModel.js";
import Employee from "../models/Employee.js";
import PFLedger from "../models/PFLedger.js";
import Payroll from "../models/Payroll.js";
import OffboardingProcess from "../models/OffboardingProcess.js";

// Disable mongoose buffering and real emails during unit tests
mongoose.set("bufferCommands", false);
User.findOne = async () => null;
User.find = () => ({ select: async () => [] });
process.env.EMAIL = "";
process.env.EMAIL_PASSWORD = "";
import Candidate from "../models/Candidate.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import Organization from "../models/Organization.js";
Candidate.updateMany = async () => ({});
OnboardingProcess.findOne = async () => null;
Organization.find = () => ({
  select: () => ({
    lean: async () => [],
  }),
});
import fs from "node:fs";
import path from "node:path";
import Notification from "../models/Notification.js";

const resolveClientFile = (rel) => {
  const p1 = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "..", rel);
  if (fs.existsSync(p2)) return p2;
  return p1;
};

import {
  paySingleSalary,
  payAllSalaries,
  getCleanAccountNumber,
  getSuperAdminPayroll,
} from "../controllers/superAdminPayrollController.js";
import {
  completeOffboarding,
  settlePF,
  getExitPackageDetails,
} from "../controllers/offboardingController.js";

// Helper for mocking Express req / res
const createMockReqRes = ({ body = {}, query = {}, params = {}, user = {} } = {}) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    body,
    query,
    params,
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

describe("Provident Fund (PF) Tracking & Payout System", () => {
  test("1. Employee schema includes pf_percentage (default 12) and bank_account_number", () => {
    const pfPath = Employee.schema.path("pf_percentage");
    assert.ok(pfPath, "pf_percentage path should exist on Employee schema");
    assert.strictEqual(pfPath.defaultValue, 12);

    const bankAccPath = Employee.schema.path("bank_account_number");
    assert.ok(bankAccPath, "bank_account_number path should exist on Employee schema");
    assert.strictEqual(bankAccPath.instance, "String");
  });

  test("2. PFLedger schema tracks cumulative PF per employee per org, with history array", () => {
    const empIdPath = PFLedger.schema.path("employee_id");
    assert.ok(empIdPath, "employee_id path should exist on PFLedger schema");

    const totalPfPath = PFLedger.schema.path("total_accumulated_pf");
    assert.ok(totalPfPath, "total_accumulated_pf path should exist on PFLedger schema");
    assert.strictEqual(totalPfPath.defaultValue, 0);

    const historyPath = PFLedger.schema.path("history");
    assert.ok(historyPath, "history array should exist on PFLedger schema");
  });

  test("3. paySingleSalary deducts PF, updates PFLedger, records on Payroll, and includes masked Account No. in notification", async () => {
    const origEmpFindById = Employee.findById;
    const origPayrollFindOne = Payroll.findOne;
    const origPayrollSave = Payroll.prototype.save;
    const origLedgerFindOneAndUpdate = PFLedger.findOneAndUpdate;

    let savedPayroll = null;
    let ledgerUpdateParams = null;

    try {
      const mockEmployee = {
        _id: "emp_101",
        employee_code: "EMP101",
        employment_status: "Active",
        month_salary: 50000,
        pf_percentage: 12,
        bank_account_number: "987654321234",
        account_number: "987654321234",
        user_id: {
          _id: "user_101",
          name: "Alice Johnson",
          email: "alice@example.com",
          role: "Employee",
          phone: "9876543210",
        },
        organizationId: {
          _id: "org_101",
          name: "Infinetra Technologies",
        },
        save: async () => {},
      };

      Employee.findById = () => ({
        populate: () => ({
          populate: async () => mockEmployee,
        }),
      });

      Payroll.findOne = async () => null;
      Payroll.prototype.save = async function () {
        savedPayroll = this;
        return this;
      };

      PFLedger.findOneAndUpdate = async (filter, update) => {
        ledgerUpdateParams = { filter, update };
        return { total_accumulated_pf: update.$inc.total_accumulated_pf };
      };

      const { req, res } = createMockReqRes({
        body: { employeeId: "emp_101", month: 9, year: 2026 },
        user: { id: "super_admin_id", role: "super_admin" },
      });

      await paySingleSalary(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.hasBankAccount, true);

      // Verify PF deduction: 50,000 * 12% = 6,000; Net Paid = 44,000
      assert.strictEqual(data.pfAmount, 6000);
      assert.strictEqual(data.netPaidAmount, 44000);

      // Verify Payroll model saved fields
      assert.ok(savedPayroll, "Payroll record should have been saved");
      assert.strictEqual(savedPayroll.basicSalary, 50000);
      assert.strictEqual(savedPayroll.grossSalary, 50000);
      assert.strictEqual(savedPayroll.pf_percentage, 12);
      assert.strictEqual(savedPayroll.pf_amount, 6000);
      assert.strictEqual(savedPayroll.netSalary, 44000);
      assert.strictEqual(savedPayroll.accountNumber, "XXXX1234");

      // Verify PFLedger update
      assert.ok(ledgerUpdateParams, "PFLedger should have been updated");
      assert.strictEqual(ledgerUpdateParams.update.$inc.total_accumulated_pf, 6000);
      assert.strictEqual(ledgerUpdateParams.update.$set.last_pf_contribution, 6000);
    } finally {
      Employee.findById = origEmpFindById;
      Payroll.findOne = origPayrollFindOne;
      Payroll.prototype.save = origPayrollSave;
      PFLedger.findOneAndUpdate = origLedgerFindOneAndUpdate;
    }
  });

  test("4. paySingleSalary gracefully omits 'Account No.' from notification when no bank account is configured and flags hasBankAccount: false", async () => {
    const origEmpFindById = Employee.findById;
    const origPayrollFindOne = Payroll.findOne;
    const origPayrollSave = Payroll.prototype.save;
    const origLedgerFindOneAndUpdate = PFLedger.findOneAndUpdate;

    try {
      const mockEmployeeNoBank = {
        _id: "emp_no_bank",
        employee_code: "EMP102",
        employment_status: "Active",
        month_salary: 60000,
        pf_percentage: 10,
        bank_account_number: "",
        account_number: "XXXX6787", // default placeholder, not a real account
        user_id: {
          _id: "user_102",
          name: "Bob Smith",
          email: "bob@example.com",
          role: "Employee",
          phone: "9988776655",
        },
        organizationId: {
          _id: "org_101",
          name: "Infinetra Technologies",
        },
        save: async () => {},
      };

      // Verify getCleanAccountNumber helper recognizes this has no bank account
      assert.strictEqual(getCleanAccountNumber(mockEmployeeNoBank), "");

      Employee.findById = () => ({
        populate: () => ({
          populate: async () => mockEmployeeNoBank,
        }),
      });

      Payroll.findOne = async () => null;
      Payroll.prototype.save = async function () {
        return this;
      };
      PFLedger.findOneAndUpdate = async () => ({});

      const { req, res } = createMockReqRes({
        body: { employeeId: "emp_no_bank", month: 9, year: 2026 },
        user: { id: "super_admin_id", role: "super_admin" },
      });

      await paySingleSalary(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.hasBankAccount, false);
      // 60,000 * 10% = 6,000; Net = 54,000
      assert.strictEqual(data.pfAmount, 6000);
      assert.strictEqual(data.netPaidAmount, 54000);
    } finally {
      Employee.findById = origEmpFindById;
      Payroll.findOne = origPayrollFindOne;
      Payroll.prototype.save = origPayrollSave;
      PFLedger.findOneAndUpdate = origLedgerFindOneAndUpdate;
    }
  });

  test("5. payAllSalaries applies PF deductions and updates PFLedger for all pending employees", async () => {
    const origOffboardFind = OffboardingProcess.find;
    const origEmpFind = Employee.find;
    const origPayrollFind = Payroll.find;
    const origPayrollFindOne = Payroll.findOne;
    const origPayrollSave = Payroll.prototype.save;
    const origLedgerFindOneAndUpdate = PFLedger.findOneAndUpdate;

    const ledgerIncrements = [];

    try {
      OffboardingProcess.find = () => ({
        select: async () => [],
      });

      const mockEmployees = [
        {
          _id: "emp_bulk_1",
          employee_code: "EMP201",
          employment_status: "Active",
          month_salary: 50000,
          pf_percentage: 12,
          bank_account_number: "111122223333",
          user_id: { _id: "u1", name: "User One", email: "u1@test.com", role: "Employee" },
          organizationId: { _id: "org_1", name: "Org One" },
          save: async () => {},
        },
        {
          _id: "emp_bulk_2",
          employee_code: "EMP202",
          employment_status: "Active",
          month_salary: 40000,
          pf_percentage: 10,
          bank_account_number: "444455556666",
          user_id: { _id: "u2", name: "User Two", email: "u2@test.com", role: "Employee" },
          organizationId: { _id: "org_1", name: "Org One" },
          save: async () => {},
        },
      ];

      Employee.find = () => ({
        populate: () => ({
          populate: async () => mockEmployees,
        }),
      });

      // No employees paid yet this month
      Payroll.find = async () => [];
      Payroll.findOne = async () => null;
      Payroll.prototype.save = async function () {
        return this;
      };

      PFLedger.findOneAndUpdate = async (filter, update) => {
        ledgerIncrements.push(update.$inc.total_accumulated_pf);
        return {};
      };

      const { req, res } = createMockReqRes({
        body: { month: 9, year: 2026 },
        user: { id: "super_admin_id", role: "super_admin" },
      });

      await payAllSalaries(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.paidCount, 2);

      // Emp 1: 50000 * 12% = 6000 PF, Net = 44000
      // Emp 2: 40000 * 10% = 4000 PF, Net = 36000
      // Total net dispatched: 44000 + 36000 = 80000
      assert.strictEqual(data.totalAmount, 80000);
      assert.deepStrictEqual(ledgerIncrements, [6000, 4000]);
    } finally {
      OffboardingProcess.find = origOffboardFind;
      Employee.find = origEmpFind;
      Payroll.find = origPayrollFind;
      Payroll.findOne = origPayrollFindOne;
      Payroll.prototype.save = origPayrollSave;
      PFLedger.findOneAndUpdate = origLedgerFindOneAndUpdate;
    }
  });

  test("6. completeOffboarding automatically settles PF, triggers notification with bank account, and is idempotent", async () => {
    const origOffboardFindById = OffboardingProcess.findById;
    const origEmpFindByIdAndUpdate = Employee.findByIdAndUpdate;
    const origLedgerFindOne = PFLedger.findOne;
    const origPayrollFind = Payroll.find;
    const origNotifCreate = Notification.create;

    const notificationsDispatched = [];

    try {
      Notification.create = async (notif) => {
        notificationsDispatched.push(notif);
        return notif;
      };

      Employee.findByIdAndUpdate = async () => ({});

      let savedCount = 0;
      const mockEmpId = new mongoose.Types.ObjectId();
      const mockUserId = new mongoose.Types.ObjectId();
      const mockOffboarding = {
        _id: new mongoose.Types.ObjectId(),
        status: "In Progress",
        pf_settled: false,
        pf_settlement_amount: 0,
        employee_id: {
          _id: mockEmpId,
          bank_account_number: "987654321234",
          user_id: {
            _id: mockUserId,
            name: "Alice Bob",
            email: "alice@test.com",
          },
        },
        save: async function () {
          savedCount++;
          return this;
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      PFLedger.findOne = async () => ({
        employee_id: mockEmpId,
        total_accumulated_pf: 72000,
      });

      Payroll.find = async () => [];

      // 6a. Completing an offboarding automatically sets pf_settled = true with correct total
      const { req: req1, res: res1 } = createMockReqRes({
        params: { id: "off_auto_settle_1" },
        body: { status: "Completed" },
        user: { id: "hr_admin_1", role: "admin" },
      });

      await completeOffboarding(req1, res1);

      assert.strictEqual(res1.getStatusCode(), 200);
      assert.strictEqual(mockOffboarding.status, "Completed");
      assert.strictEqual(mockOffboarding.pf_settled, true);
      assert.strictEqual(mockOffboarding.pf_settlement_amount, 72000);
      assert.ok(mockOffboarding.pf_settled_at instanceof Date, "pf_settled_at should be set to current Date");

      // 6b. Employee receives the PF-settled notification automatically at the same time as the Experience Letter notification
      const expLetterNotif = notificationsDispatched.find((n) =>
        n.message?.includes("experience letter is ready to download")
      );
      assert.ok(expLetterNotif, "Experience letter notification should be dispatched");

      const pfNotif = notificationsDispatched.find((n) =>
        n.message?.includes("accumulated PF of ₹72,000 has been settled and credited to your account 987654321234")
      );
      assert.ok(pfNotif, "Automatic PF settlement notification should be dispatched with bank account");
      assert.strictEqual(String(pfNotif.recipient), String(mockUserId));
      assert.strictEqual(pfNotif.link, "/employee/offboarding");

      // 6c. Re-running completeOffboarding on an already-completed offboarding does not double-pay PF (idempotency check)
      const countBeforeSecond = notificationsDispatched.length;
      const { req: req2, res: res2 } = createMockReqRes({
        params: { id: "off_auto_settle_1" },
        body: { status: "Completed" },
        user: { id: "hr_admin_1", role: "admin" },
      });

      await completeOffboarding(req2, res2);

      assert.strictEqual(res2.getStatusCode(), 200);
      assert.strictEqual(mockOffboarding.pf_settlement_amount, 72000, "PF settlement amount should not change or double-count");
      
      const newPfNotifs = notificationsDispatched.slice(countBeforeSecond).filter((n) =>
        n.message?.includes("accumulated PF")
      );
      assert.strictEqual(newPfNotifs.length, 0, "No duplicate PF settlement notifications should be dispatched on re-run");
    } finally {
      OffboardingProcess.findById = origOffboardFindById;
      Employee.findByIdAndUpdate = origEmpFindByIdAndUpdate;
      PFLedger.findOne = origLedgerFindOne;
      Payroll.find = origPayrollFind;
      Notification.create = origNotifCreate;
    }
  });

  test("7. OffboardingDetails.jsx has manual 'Pay PF' button removed and displays read-only confirmation", () => {
    const filePath = resolveClientFile(
      "client/src/pages/Offboarding/OffboardingDetails.jsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");

    // Ensure button is completely removed, not just hidden
    assert.ok(!content.includes('id="settle-pf-btn"'), "settle-pf-btn must be completely removed");
    assert.ok(!content.includes('"Pay PF"'), 'Manual "Pay PF" text must not exist in OffboardingDetails.jsx');
    assert.ok(!content.includes("settlingPf"), 'settlingPf state must not exist in OffboardingDetails.jsx');
    assert.ok(!content.includes("handleSettlePf"), 'handleSettlePf method must not exist in OffboardingDetails.jsx');

    // Ensure read-only confirmation is rendered
    assert.ok(content.includes("PF Settled:"), 'OffboardingDetails.jsx must display "PF Settled:" confirmation');
    assert.ok(content.includes("Settled Automatically"), 'OffboardingDetails.jsx must display "Settled Automatically" badge');
  });

  test("8. SuperAdminPayroll.jsx has no manual Pay PF button and PF column is read-only", () => {
    const filePath = resolveClientFile(
      "client/src/pages/SuperAdmin/SuperAdminPayroll.jsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(!content.toLowerCase().includes("pay pf"), 'SuperAdminPayroll.jsx must not contain any "Pay PF" button or action');
    assert.ok(content.includes('key: "pf_amount"'), 'SuperAdminPayroll.jsx must contain read-only pf_amount column');
  });

  test("9. getSuperAdminPayroll computes current_month_total_pf, total_accumulated_pf_active, and total_pf_settled_offboarded with org filtering", async () => {
    const origOffboardFind = OffboardingProcess.find;
    const origOffboardAggregate = OffboardingProcess.aggregate;
    const origEmpFind = Employee.find;
    const origEmpAggregate = Employee.aggregate;
    const origPayrollFind = Payroll.find;
    const origLedgerAggregate = PFLedger.aggregate;

    const orgAId = new mongoose.Types.ObjectId();
    const orgBId = new mongoose.Types.ObjectId();

    const emp1Id = new mongoose.Types.ObjectId(); // Active in Org A (salary 50000, 12% PF -> 6000)
    const emp2Id = new mongoose.Types.ObjectId(); // Active in Org B (salary 100000, 10% PF -> 10000)
    const empOffId = new mongoose.Types.ObjectId(); // Offboarded in Org A (settled PF 36000)

    const mockEmployees = [
      {
        _id: emp1Id,
        employee_code: "EMP-A1",
        employment_status: "Active",
        month_salary: 50000,
        pf_percentage: 12,
        organizationId: { _id: orgAId, name: "Org Alpha" },
        user_id: { _id: new mongoose.Types.ObjectId(), name: "Alpha One", role: "Employee" },
      },
      {
        _id: emp2Id,
        employee_code: "EMP-B1",
        employment_status: "Active",
        month_salary: 100000,
        pf_percentage: 10,
        organizationId: { _id: orgBId, name: "Org Beta" },
        user_id: { _id: new mongoose.Types.ObjectId(), name: "Beta One", role: "Employee" },
      },
    ];

    const mockOffboardings = [
      {
        _id: new mongoose.Types.ObjectId(),
        employee_id: { _id: empOffId },
        organizationId: orgAId,
        status: "Completed",
        pf_settled: true,
        pf_settlement_amount: 36000,
      },
    ];

    const mockLedgers = [
      { employee_id: emp1Id, organizationId: orgAId, total_accumulated_pf: 24000 },
      { employee_id: emp2Id, organizationId: orgBId, total_accumulated_pf: 50000 },
      { employee_id: empOffId, organizationId: orgAId, total_accumulated_pf: 36000 }, // Offboarded: MUST be excluded from active
    ];

    try {
      OffboardingProcess.find = (query = {}) => ({
        select: async () => {
          let list = mockOffboardings;
          if (query.organizationId) {
            list = list.filter((o) => String(o.organizationId) === String(query.organizationId));
          }
          return list;
        },
      });

      OffboardingProcess.aggregate = async (pipeline) => {
        const match = pipeline[0]?.$match || {};
        let list = mockOffboardings.filter((o) => o.status === "Completed");
        if (match.organizationId) {
          list = list.filter((o) => String(o.organizationId) === String(match.organizationId));
        }
        const total = list.reduce((sum, o) => sum + (o.pf_settlement_amount || 0), 0);
        return [{ _id: null, total }];
      };

      Employee.find = (query = {}) => {
        let list = mockEmployees;
        if (query.organizationId) {
          list = list.filter(
            (e) => String(e.organizationId?._id || e.organizationId) === String(query.organizationId)
          );
        }
        return {
          populate: () => ({
            populate: () => ({
              populate: async () => list,
            }),
          }),
        };
      };

      Employee.aggregate = async (pipeline) => {
        const match = pipeline[0]?.$match || {};
        let list = mockEmployees.filter((e) => e.employment_status === "Active");
        if (match.organizationId) {
          list = list.filter(
            (e) => String(e.organizationId?._id || e.organizationId) === String(match.organizationId)
          );
        }
        const total = list.reduce((sum, e) => {
          const sal = e.month_salary || 50000;
          const pct = e.pf_percentage !== undefined ? e.pf_percentage : 12;
          return sum + Math.round((sal * pct) / 100);
        }, 0);
        return [{ _id: null, total }];
      };

      PFLedger.aggregate = async (pipeline) => {
        const match = pipeline[0]?.$match || {};
        let list = mockLedgers;
        if (match.organizationId) {
          list = list.filter((l) => String(l.organizationId) === String(match.organizationId));
        }
        if (match.employee_id?.$in) {
          const allowed = new Set(match.employee_id.$in.map(String));
          list = list.filter((l) => allowed.has(String(l.employee_id)));
        }
        const total = list.reduce((sum, l) => sum + (l.total_accumulated_pf || 0), 0);
        return [{ _id: null, total }];
      };

      PFLedger.find = async (query = {}) => {
        let list = mockLedgers;
        if (query.employee_id?.$in) {
          const allowed = new Set(query.employee_id.$in.map(String));
          list = list.filter((l) => allowed.has(String(l.employee_id)));
        }
        return list;
      };

      Payroll.find = async () => [];

      // 1. ALL ORGANIZATIONS (Platform-wide)
      const { req: allReq, res: allRes } = createMockReqRes({
        query: { month: 9, year: 2026, organizationId: "all" },
      });
      await getSuperAdminPayroll(allReq, allRes);

      assert.strictEqual(allRes.getStatusCode(), 200);
      const allData = allRes.getData();
      assert.strictEqual(allData.success, true);
      // Expected:
      // This Month's PF: 6000 (emp1) + 10000 (emp2) = 16000
      assert.strictEqual(allData.current_month_total_pf, 16000);
      // Total Accumulated PF (Active Employees): 24000 (emp1) + 50000 (emp2) = 74000 (empOff excluded)
      assert.strictEqual(allData.total_accumulated_pf_active, 74000);
      // Total PF Settled (Offboarded Employees): 36000 (empOff)
      assert.strictEqual(allData.total_pf_settled_offboarded, 36000);

      // Verify per-row Total PF in allData.records
      const r1 = allData.records.find((r) => String(r._id) === String(emp1Id));
      const r2 = allData.records.find((r) => String(r._id) === String(emp2Id));
      assert.strictEqual(r1.total_pf, 24000, "Employee 1 row Total PF should be 24000");
      assert.strictEqual(r2.total_pf, 50000, "Employee 2 row Total PF should be 50000");

      // 2. SCOPED TO ORG A
      const { req: orgAReq, res: orgARes } = createMockReqRes({
        query: { month: 9, year: 2026, organizationId: String(orgAId) },
      });
      await getSuperAdminPayroll(orgAReq, orgARes);

      assert.strictEqual(orgARes.getStatusCode(), 200);
      const orgAData = orgARes.getData();
      assert.strictEqual(orgAData.current_month_total_pf, 6000);
      assert.strictEqual(orgAData.total_accumulated_pf_active, 24000);
      assert.strictEqual(orgAData.total_pf_settled_offboarded, 36000);

      // 3. SCOPED TO ORG B
      const { req: orgBReq, res: orgBRes } = createMockReqRes({
        query: { month: 9, year: 2026, organizationId: String(orgBId) },
      });
      await getSuperAdminPayroll(orgBReq, orgBRes);

      assert.strictEqual(orgBRes.getStatusCode(), 200);
      const orgBData = orgBRes.getData();
      assert.strictEqual(orgBData.current_month_total_pf, 10000);
      assert.strictEqual(orgBData.total_accumulated_pf_active, 50000);
      assert.strictEqual(orgBData.total_pf_settled_offboarded, 0); // No completed offboardings for Org B
    } finally {
      OffboardingProcess.find = origOffboardFind;
      OffboardingProcess.aggregate = origOffboardAggregate;
      Employee.find = origEmpFind;
      Employee.aggregate = origEmpAggregate;
      Payroll.find = origPayrollFind;
      PFLedger.aggregate = origLedgerAggregate;
    }
  });

  test("10. SuperAdminPayroll.jsx includes per-row Total PF column positioned between PF and Pay button, and aggregate card is removed", () => {
    const filePath = resolveClientFile(
      "client/src/pages/SuperAdmin/SuperAdminPayroll.jsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");

    // Check aggregate card was removed completely
    assert.strictEqual(
      content.includes('id="total-pf-summary-card"'),
      false,
      "Aggregate Total PF summary card (total-pf-summary-card) must be removed"
    );

    // Check Total PF column is defined
    assert.ok(content.includes('key: "total_pf"'), "Total PF column definition should exist");
    assert.ok(content.includes('header: "Total PF"'), "Total PF header should exist");

    // Check column order: PF column < Total PF column < Pay button column
    const pfIndex = content.indexOf('key: "pf_amount"');
    const totalPfIndex = content.indexOf('key: "total_pf"');
    const payIndex = content.indexOf('key: "pay_salary_action"');

    assert.ok(pfIndex !== -1, "PF column must exist");
    assert.ok(totalPfIndex !== -1, "Total PF column must exist");
    assert.ok(payIndex !== -1, "Pay salary column must exist");
    assert.ok(pfIndex < totalPfIndex, "Total PF column must be placed after PF column");
    assert.ok(totalPfIndex < payIndex, "Total PF column must be placed before Pay button column");
  });

  test("11. Per-row Total PF equals sum of N months of paid payroll, two employees show independent values, and matches offboarding pf_settlement_amount", async () => {
    const origOffboardFind = OffboardingProcess.find;
    const origOffboardFindById = OffboardingProcess.findById;
    const origEmpFind = Employee.find;
    const origEmpFindById = Employee.findById;
    const origEmpFindOneAndUpdate = Employee.findOneAndUpdate;
    const origEmpFindByIdAndUpdate = Employee.findByIdAndUpdate;
    const origPayrollFind = Payroll.find;
    const origLedgerFind = PFLedger.find;
    const origLedgerFindOne = PFLedger.findOne;

    const empAlphaId = new mongoose.Types.ObjectId();
    const empBetaId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    // Employee Alpha: 3 months of paid payroll @ 6000 PF/month = 18,000 Total PF
    // Employee Beta: 5 months of paid payroll @ 12000 PF/month = 60,000 Total PF
    const paidPayrolls = [
      { employeeId: empAlphaId, pf_amount: 6000, status: "Paid", month: 1, year: 2026 },
      { employeeId: empAlphaId, pf_amount: 6000, status: "Paid", month: 2, year: 2026 },
      { employeeId: empAlphaId, pf_amount: 6000, status: "Paid", month: 3, year: 2026 },
      { employeeId: empBetaId, pf_amount: 12000, status: "Paid", month: 1, year: 2026 },
      { employeeId: empBetaId, pf_amount: 12000, status: "Paid", month: 2, year: 2026 },
      { employeeId: empBetaId, pf_amount: 12000, status: "Paid", month: 3, year: 2026 },
      { employeeId: empBetaId, pf_amount: 12000, status: "Paid", month: 4, year: 2026 },
      { employeeId: empBetaId, pf_amount: 12000, status: "Paid", month: 5, year: 2026 },
    ];

    const mockEmployees = [
      {
        _id: empAlphaId,
        employee_code: "EMP-ALPHA",
        employment_status: "Active",
        month_salary: 50000,
        pf_percentage: 12,
        organizationId: { _id: orgId, name: "Test Corp" },
        user_id: { _id: new mongoose.Types.ObjectId(), name: "Alpha Dev", role: "Employee" },
      },
      {
        _id: empBetaId,
        employee_code: "EMP-BETA",
        employment_status: "Active",
        month_salary: 100000,
        pf_percentage: 12,
        organizationId: { _id: orgId, name: "Test Corp" },
        user_id: { _id: new mongoose.Types.ObjectId(), name: "Beta Dev", role: "Employee" },
      },
    ];

    try {
      OffboardingProcess.find = () => ({
        select: async () => [],
      });

      Employee.find = () => ({
        populate: () => ({
          populate: () => ({
            populate: async () => mockEmployees,
          }),
        }),
      });

      Employee.findOneAndUpdate = async () => ({});
      Employee.findByIdAndUpdate = async () => ({});

      // PFLedger returns accumulated PF matching their employment history
      PFLedger.find = async (query = {}) => {
        return [
          { employee_id: empAlphaId, total_accumulated_pf: 18000, organizationId: orgId },
          { employee_id: empBetaId, total_accumulated_pf: 60000, organizationId: orgId },
        ];
      };

      Payroll.find = async (query = {}) => {
        if (query.employeeId?.$in) {
          const allowed = new Set(query.employeeId.$in.map(String));
          return paidPayrolls.filter((p) => allowed.has(String(p.employeeId)));
        }
        return [];
      };

      const { req, res } = createMockReqRes({ query: { month: 9, year: 2026 } });
      await getSuperAdminPayroll(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.records.length, 2);

      const rowAlpha = data.records.find((r) => String(r._id) === String(empAlphaId));
      const rowBeta = data.records.find((r) => String(r._id) === String(empBetaId));

      // 1. For a given employee with N months of paid payroll, "Total PF" in their row equals
      //    the sum of pf_amount across exactly those N months (not any other employee's)
      assert.strictEqual(rowAlpha.total_pf, 18000, "Alpha's Total PF must equal exactly 3 months sum (18,000)");
      assert.strictEqual(rowAlpha.pfAmount, 6000, "Alpha's current month PF must be 6,000");

      // 2. Two different employees in the same table show two different, independently correct Total PF values
      assert.strictEqual(rowBeta.total_pf, 60000, "Beta's Total PF must equal exactly 5 months sum (60,000)");
      assert.strictEqual(rowBeta.pfAmount, 12000, "Beta's current month PF must be 12,000");
      assert.notStrictEqual(rowAlpha.total_pf, rowBeta.total_pf, "Two employees must have independent Total PF");

      // 3. This number matches exactly what gets set as pf_settlement_amount if/when that employee is later offboarded
      const mockAlphaOffboarding = {
        _id: new mongoose.Types.ObjectId(),
        employee_id: { _id: empAlphaId, user_id: { _id: new mongoose.Types.ObjectId() } },
        organizationId: orgId,
        status: "Initiated",
        pf_settled: false,
        pf_settlement_amount: 0,
        save: async function () {
          return this;
        },
      };

      OffboardingProcess.findById = () => ({
        populate: () => Promise.resolve(mockAlphaOffboarding),
      });

      PFLedger.findOne = async () => ({
        employee_id: empAlphaId,
        total_accumulated_pf: 18000,
      });

      const { req: offReq, res: offRes } = createMockReqRes({
        params: { id: String(mockAlphaOffboarding._id) },
        body: { status: "Completed" },
        user: { id: "admin_1" },
      });

      await completeOffboarding(offReq, offRes);
      assert.strictEqual(offRes.getStatusCode(), 200);

      // pf_settlement_amount matches Alpha's row total_pf exactly!
      assert.strictEqual(
        mockAlphaOffboarding.pf_settlement_amount,
        rowAlpha.total_pf,
        `Offboarding pf_settlement_amount (${mockAlphaOffboarding.pf_settlement_amount}) must match table row total_pf (${rowAlpha.total_pf})`
      );
      assert.strictEqual(mockAlphaOffboarding.pf_settled, true);
    } finally {
      OffboardingProcess.find = origOffboardFind;
      OffboardingProcess.findById = origOffboardFindById;
      Employee.find = origEmpFind;
      Employee.findById = origEmpFindById;
      Employee.findOneAndUpdate = origEmpFindOneAndUpdate;
      Employee.findByIdAndUpdate = origEmpFindByIdAndUpdate;
      Payroll.find = origPayrollFind;
      PFLedger.find = origLedgerFind;
      PFLedger.findOne = origLedgerFindOne;
    }
  });
});
