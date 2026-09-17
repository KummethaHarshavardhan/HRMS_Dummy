import { describe, test } from "node:test";
import assert from "node:assert";
import Employee from "../models/Employee.js";
import OffboardingProcess from "../models/OffboardingProcess.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import Payroll from "../models/Payroll.js";
import { getSuperAdminPayroll } from "../controllers/superAdminPayrollController.js";

const createMockReqRes = (query = {}) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    query,
    user: { id: "super_admin_id", role: "super_admin" },
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

describe("SuperAdmin Payroll - Offboarded & Inactive Employee Exclusion", () => {
  test("getSuperAdminPayroll excludes inactive employees and employees with completed offboarding", async () => {
    const originalOffboardFind = OffboardingProcess.find;
    const originalOnboardFindOne = OnboardingProcess.findOne;
    const originalEmpFind = Employee.find;
    const originalPayrollFind = Payroll.find;

    try {
      // Mock OffboardingProcess: emp_offboarded has completed offboarding
      OffboardingProcess.find = () => ({
        select: async () => [
          {
            employee_id: "emp_offboarded",
            completed_at: new Date("2026-09-01"),
            updatedAt: new Date("2026-09-01"),
          },
        ],
      });

      // No newer completed onboarding for emp_offboarded
      OnboardingProcess.findOne = async () => null;

      // Mock Payroll find
      Payroll.find = async () => [];

      // Mock Employee.find capturing query filter
      let capturedFilter = null;
      Employee.find = (filter) => {
        capturedFilter = filter;
        return {
          populate: () => ({
            populate: () => ({
              populate: async () => [
                {
                  _id: "emp_active_1",
                  employee_code: "EMP001",
                  employment_status: "Active",
                  month_salary: 50000,
                  user_id: { role: "EMPLOYEE", name: "Active User", email: "active@test.com" },
                  organizationId: { name: "Org 1" },
                  department_id: { name: "Engineering" },
                },
              ],
            }),
          }),
        };
      };

      const { req, res } = createMockReqRes({ month: 9, year: 2026 });
      await getSuperAdminPayroll(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();
      assert.strictEqual(data.success, true);

      // Verify that query filter enforces Active status AND excludes offboarded employee ID
      assert.strictEqual(capturedFilter.employment_status, "Active");
      assert.deepStrictEqual(capturedFilter._id, { $nin: ["emp_offboarded"] });

      // Verify records list only contains active employee
      assert.strictEqual(data.records.length, 1);
      assert.strictEqual(data.records[0]._id, "emp_active_1");
      assert.strictEqual(data.records[0].employeeCode, "EMP001");
    } finally {
      OffboardingProcess.find = originalOffboardFind;
      OnboardingProcess.findOne = originalOnboardFindOne;
      Employee.find = originalEmpFind;
      Payroll.find = originalPayrollFind;
    }
  });

  test("getSuperAdminPayroll excludes SUPER_ADMIN role account from employee payroll table", async () => {
    const originalOffboardFind = OffboardingProcess.find;
    const originalOnboardFindOne = OnboardingProcess.findOne;
    const originalEmpFind = Employee.find;
    const originalPayrollFind = Payroll.find;

    try {
      OffboardingProcess.find = () => ({
        select: async () => [],
      });
      OnboardingProcess.findOne = async () => null;
      Payroll.find = async () => [];

      Employee.find = () => ({
        populate: () => ({
          populate: () => ({
            populate: async () => [
              {
                _id: "emp_super_admin",
                employee_code: "EMP000",
                employment_status: "Active",
                month_salary: 100000,
                user_id: { role: "SUPER_ADMIN", name: "Super User", email: "super@test.com" },
              },
              {
                _id: "emp_regular",
                employee_code: "EMP002",
                employment_status: "Active",
                month_salary: 60000,
                user_id: { role: "HR", name: "HR User", email: "hr@test.com" },
              },
            ],
          }),
        }),
      });

      const { req, res } = createMockReqRes({ month: 9, year: 2026 });
      await getSuperAdminPayroll(req, res);

      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getData();
      assert.strictEqual(data.records.length, 1);
      assert.strictEqual(data.records[0]._id, "emp_regular");
      assert.strictEqual(data.records[0].employeeCode, "EMP002");
    } finally {
      OffboardingProcess.find = originalOffboardFind;
      OnboardingProcess.findOne = originalOnboardFindOne;
      Employee.find = originalEmpFind;
      Payroll.find = originalPayrollFind;
    }
  });
});
