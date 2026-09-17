import { describe, test } from "node:test";
import assert from "node:assert";
import Employee from "../models/Employee.js";
import Candidate from "../models/Candidate.js";
import Employees from "../models/UserModel.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import OffboardingProcess from "../models/OffboardingProcess.js";
import {
  updateEmployee,
  updateEmployeeStatus,
} from "../controllers/EmployeeController.js";
import {
  createOnboarding,
  updateOnboardingStatus,
  getEmployeeLifecycleHistory,
} from "../controllers/onboardingController.js";
import { EmpLogin } from "../controllers/userController.js";
import bcrypt from "bcrypt";

const createMockReqRes = (body = {}, params = {}, user = { id: "admin_1", role: "super_admin", organizationId: "org_1" }) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    body,
    params,
    user,
    headers: {},
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

describe("Issue B: Safeguards Against Direct Reactivation & Rejoin via Onboarding", () => {
  describe("1. Block Direct Reactivation Guard (Backend)", () => {
    test("updateEmployee rejects changing employment_status from Inactive to Active with 400", async () => {
      const originalFindById = Employee.findById;
      const validEmpId = "607f1f77bcf86cd799439011";

      try {
        // Mock finding an existing Inactive employee
        Employee.findById = async () => ({
          _id: validEmpId,
          employment_status: "Inactive",
          save: async () => {},
        });

        const { req, res } = createMockReqRes(
          { employment_status: "Active" },
          { id: validEmpId }
        );

        await updateEmployee(req, res);

        assert.strictEqual(res.getStatusCode(), 400);
        assert.strictEqual(
          res.getData()?.message,
          "Cannot reactivate directly. Use the rejoin/onboarding flow."
        );
      } finally {
        Employee.findById = originalFindById;
      }
    });

    test("updateEmployeeStatus rejects changing employment_status from Inactive to Active with 400", async () => {
      const originalFindById = Employee.findById;
      const validEmpId = "607f1f77bcf86cd799439011";

      try {
        Employee.findById = async () => ({
          _id: validEmpId,
          employment_status: "Inactive",
          save: async () => {},
        });

        const { req, res } = createMockReqRes(
          { employment_status: "Active" },
          { id: validEmpId }
        );

        await updateEmployeeStatus(req, res);

        assert.strictEqual(res.getStatusCode(), 400);
        assert.strictEqual(
          res.getData()?.message,
          "Cannot reactivate directly. Use the rejoin/onboarding flow."
        );
      } finally {
        Employee.findById = originalFindById;
      }
    });
  });

  describe("2. Rejoin via Fresh Onboarding Flow", () => {
    test("createOnboarding allows initiating fresh onboarding for an Inactive employee", async () => {
      const originalEmpFindById = Employee.findById;
      const originalOnboardFindOne = OnboardingProcess.findOne;
      const originalOnboardCreate = OnboardingProcess.create;

      try {
        Employee.findById = () => ({
          populate: async () => ({
            _id: "emp_inactive_1",
            employment_status: "Inactive",
            user_id: { _id: "user_1", name: "Rejoining Employee" },
          }),
        });

        // No active in-progress onboarding
        OnboardingProcess.findOne = async () => null;

        let createdPayload = null;
        OnboardingProcess.create = async (payload) => {
          createdPayload = payload;
          return {
            _id: "new_onboard_2",
            ...payload,
          };
        };

        // Mock findById for populated return
        OnboardingProcess.findById = () => ({
          populate: async () => ({
            _id: "new_onboard_2",
            employee_id: { _id: "emp_inactive_1" },
            status: "In Progress",
          }),
        });

        const { req, res } = createMockReqRes({
          employee_id: "emp_inactive_1",
          start_date: "2026-10-01",
        });

        await createOnboarding(req, res);

        assert.strictEqual(res.getStatusCode(), 201);
        assert.strictEqual(res.getData()?.success, true);
        assert.strictEqual(createdPayload.employee_id, "emp_inactive_1");
        assert.strictEqual(createdPayload.status, "In Progress");
      } finally {
        Employee.findById = originalEmpFindById;
        OnboardingProcess.findOne = originalOnboardFindOne;
        OnboardingProcess.create = originalOnboardCreate;
      }
    });

    test("createOnboarding blocks starting a new onboarding if one is already in progress", async () => {
      const originalEmpFindById = Employee.findById;
      const originalOnboardFindOne = OnboardingProcess.findOne;

      try {
        Employee.findById = () => ({
          populate: async () => ({
            _id: "emp_inactive_1",
            employment_status: "Inactive",
          }),
        });

        // Already has an active onboarding
        OnboardingProcess.findOne = async () => ({
          _id: "onboard_in_prog",
          status: "In Progress",
        });

        const { req, res } = createMockReqRes({
          employee_id: "emp_inactive_1",
        });

        await createOnboarding(req, res);

        assert.strictEqual(res.getStatusCode(), 400);
        assert.strictEqual(
          res.getData()?.message,
          "An active onboarding process is already in progress for this employee."
        );
      } finally {
        Employee.findById = originalEmpFindById;
        OnboardingProcess.findOne = originalOnboardFindOne;
      }
    });

    test("employee cannot login while status is Inactive during rejoin onboarding", async () => {
      const originalUserFind = Employees.findOne;
      const originalBcryptCompare = bcrypt.compare;
      const originalEmpFind = Employee.findOne;

      Employees.findOne = async () => ({
        _id: "user_rejoining_1",
        email: "rejoin@company.com",
        password: "hashedpassword",
        role: "employee",
      });
      bcrypt.compare = async () => true;

      // Employee is still Inactive while onboarding is in progress
      Employee.findOne = async () => ({
        _id: "emp_rejoining_1",
        employment_status: "Inactive",
      });

      try {
        const { req, res } = createMockReqRes({
          email: "rejoin@company.com",
          password: "CorrectPassword123!",
        });

        await EmpLogin(req, res);

        assert.strictEqual(res.getStatusCode(), 403);
        assert.strictEqual(
          res.getData()?.message,
          "This account has been deactivated. Contact HR for assistance."
        );
      } finally {
        Employees.findOne = originalUserFind;
        bcrypt.compare = originalBcryptCompare;
        Employee.findOne = originalEmpFind;
      }
    });

    test("completing the new rejoin onboarding flips employment_status to Active and allows login", async () => {
      const originalOnboardFind = OnboardingProcess.findById;
      const originalOffboardFind = OffboardingProcess.findOne;
      const originalEmpUpdate = Employee.findByIdAndUpdate;
      const originalCandUpdate = Candidate.updateMany;

      let updatedEmpStatus = null;
      let updatedCandStatus = null;

      try {
        // Mock new onboarding created after offboarding
        const mockNewOnboard = {
          _id: "onboard_rejoin_2",
          createdAt: new Date("2026-10-01T10:00:00Z"),
          status: "In Progress",
          employee_id: {
            _id: "emp_rejoining_1",
            user_id: { email: "rejoin@company.com" },
          },
          save: async () => {},
        };

        OnboardingProcess.findById = () => ({
          populate: async () => mockNewOnboard,
        });

        // Mock prior completed offboarding from earlier date
        OffboardingProcess.findOne = () => ({
          sort: async () => ({
            _id: "offboard_1",
            status: "Completed",
            completed_at: new Date("2026-09-15T10:00:00Z"), // Completed prior to new onboarding
          }),
        });

        Employee.findByIdAndUpdate = async (id, update) => {
          updatedEmpStatus = update.employment_status;
          return { _id: id, employment_status: update.employment_status };
        };

        Candidate.updateMany = async (filter, update) => {
          updatedCandStatus = update.status;
          return { modifiedCount: 1 };
        };

        const { req, res } = createMockReqRes(
          { status: "Completed" },
          { id: "onboard_rejoin_2" }
        );

        await updateOnboardingStatus(req, res);

        assert.strictEqual(res.getStatusCode(), 200);
        assert.strictEqual(updatedEmpStatus, "Active");
        assert.strictEqual(updatedCandStatus, "ACTIVE");
      } finally {
        OnboardingProcess.findById = originalOnboardFind;
        OffboardingProcess.findOne = originalOffboardFind;
        Employee.findByIdAndUpdate = originalEmpUpdate;
        Candidate.updateMany = originalCandUpdate;
      }
    });
  });

  describe("3. Preserve Lifecycle History Timeline", () => {
    test("getEmployeeLifecycleHistory returns all past onboarding and offboarding records chronologically", async () => {
      const originalOnboardFind = OnboardingProcess.find;
      const originalOffboardFind = OffboardingProcess.find;

      try {
        const pastOnboarding = {
          _id: "ob_initial_1",
          status: "Completed",
          createdAt: new Date("2025-01-10T09:00:00Z"),
          start_date: new Date("2025-01-10T09:00:00Z"),
          completed_at: new Date("2025-01-20T17:00:00Z"),
          checklist: [{ status: "Done" }, { status: "Done" }],
          created_by: { name: "HR Manager" },
        };
        const secondOnboarding = {
          _id: "ob_rejoin_2",
          status: "In Progress",
          createdAt: new Date("2026-10-01T09:00:00Z"),
          start_date: new Date("2026-10-01T09:00:00Z"),
          checklist: [{ status: "Done" }, { status: "Pending" }],
          created_by: { name: "HR Admin" },
        };

        const pastOffboarding = {
          _id: "off_exit_1",
          status: "Completed",
          createdAt: new Date("2026-06-01T10:00:00Z"),
          resignation_date: new Date("2026-06-01T10:00:00Z"),
          last_working_day: new Date("2026-06-30T17:00:00Z"),
          completed_at: new Date("2026-06-30T17:00:00Z"),
          exit_reason: "Career break",
          checklist: [{ status: "Done" }],
          initiated_by: { name: "HR Director" },
          experience_letter_generated_at: new Date("2026-06-30T17:00:00Z"),
        };

        OnboardingProcess.find = () => ({
          populate: () => ({
            sort: async () => [pastOnboarding, secondOnboarding],
          }),
        });

        OffboardingProcess.find = () => ({
          populate: () => ({
            sort: async () => [pastOffboarding],
          }),
        });

        const { req, res } = createMockReqRes({}, { employeeId: "emp_1" });
        await getEmployeeLifecycleHistory(req, res);

        assert.strictEqual(res.getStatusCode(), 200);
        const data = res.getData();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.onboardings.length, 2);
        assert.strictEqual(data.offboardings.length, 1);
        assert.strictEqual(data.timeline.length, 3);

        // Check chronological order in timeline
        assert.strictEqual(data.timeline[0]._id, "ob_initial_1");
        assert.strictEqual(data.timeline[0].type, "ONBOARDING");
        assert.strictEqual(data.timeline[1]._id, "off_exit_1");
        assert.strictEqual(data.timeline[1].type, "OFFBOARDING");
        assert.strictEqual(data.timeline[2]._id, "ob_rejoin_2");
        assert.strictEqual(data.timeline[2].type, "ONBOARDING");
      } finally {
        OnboardingProcess.find = originalOnboardFind;
        OffboardingProcess.find = originalOffboardFind;
      }
    });
  });
});
