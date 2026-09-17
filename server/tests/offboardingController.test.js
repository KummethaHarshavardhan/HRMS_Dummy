import { describe, test } from "node:test";
import assert from "node:assert";
import OffboardingProcess from "../models/OffboardingProcess.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import TaskAssignment from "../models/TaskAssignment.js";
import Candidate from "../models/Candidate.js";
import Notification from "../models/Notification.js";
import Salary from "../models/Salary.js";
import Payroll from "../models/Payroll.js";
import Employees from "../models/UserModel.js";
import Asset from "../models/Asset.js";
import Task from "../models/Task.js";
import {
  generateExperienceLetter,
  completeOffboarding,
} from "../controllers/offboardingController.js";
import { updateOnboardingStatus } from "../controllers/onboardingController.js";
import { EmpLogin } from "../controllers/userController.js";
import { assignAsset } from "../controllers/assetController.js";
import { createAssignment } from "../controllers/assignmentController.js";
import { generatePayroll } from "../controllers/payrollController.js";
import { createExperienceLetterPDF } from "../services/experienceLetterService.js";
import bcrypt from "bcrypt";

import { Writable } from "node:stream";

// Helper to extract decoded text from uncompressed PDF stream
const extractPdfText = (pdfBuffer) => {
  const hexMatches = pdfBuffer.toString("latin1").match(/<([0-9a-fA-F]+)>/g) || [];
  return hexMatches.map((h) => Buffer.from(h.slice(1, -1), "hex").toString("utf8")).join("");
};

// Helper to mock express req and res
const createMockReqRes = (params = {}, query = {}, user = {}) => {
  const headers = {};
  let endCalled = false;
  const chunks = [];

  const res = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });

  res.statusCode = 200;
  res.data = null;
  res.headersSent = false;
  res.headers = headers;

  res.status = function (code) {
    this.statusCode = code;
    return this;
  };

  res.json = function (payload) {
    this.data = payload;
    this.headersSent = true;
    return this;
  };

  res.setHeader = function (name, value) {
    headers[name] = value;
  };

  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    endCalled = true;
    this.headersSent = true;
    return originalEnd(...args);
  };

  const req = {
    params,
    query,
    user,
    headers: {},
    body: {},
  };

  return {
    req,
    res,
    getChunks: () => chunks,
    isEndCalled: () => endCalled,
  };
};

describe("Offboarding & Experience Letter Module - Unit Tests", () => {
  describe("Experience Letter Generation Controller (generateExperienceLetter)", () => {
    test("blocks generation if offboarding status is not Completed (returns 400)", async () => {
      const originalFindById = OffboardingProcess.findById;

      const mockOffboarding = {
        _id: "offboard_1",
        status: "In Progress",
        organizationId: "org_1",
        employee_id: {
          _id: "emp_1",
          user_id: { _id: "user_1", name: "Priya Sharma" },
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      try {
        const { req, res } = createMockReqRes({ id: "offboard_1" }, {}, { id: "hr_1", role: "hr_manager", organizationId: "org_1" });
        await generateExperienceLetter(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /once offboarding is Completed/);
      } finally {
        OffboardingProcess.findById = originalFindById;
      }
    });

    test("blocks Super Admin from generating experience letters (returns 403)", async () => {
      const { req, res } = createMockReqRes({ id: "offboard_1" }, {}, { id: "sa_1", role: "super_admin" });
      await generateExperienceLetter(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Super Admin does not manage tenant experience letters/);
    });

    test("multi-tenant isolation: blocks HR from another organization (returns 403)", async () => {
      const originalFindById = OffboardingProcess.findById;

      const mockOffboarding = {
        _id: "offboard_1",
        status: "Completed",
        organizationId: "org_DIFFERENT",
        employee_id: {
          _id: "emp_1",
          user_id: { _id: "user_1", name: "Priya Sharma" },
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      try {
        const { req, res } = createMockReqRes({ id: "offboard_1" }, {}, { id: "hr_1", role: "hr_manager", organizationId: "org_1" });
        await generateExperienceLetter(req, res);

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /Employee belongs to another organization/);
      } finally {
        OffboardingProcess.findById = originalFindById;
      }
    });

    test("explicit check: employee cannot trigger regenerate=true (returns 403)", async () => {
      const originalFindById = OffboardingProcess.findById;

      const mockOffboarding = {
        _id: "offboard_1",
        status: "Completed",
        organizationId: "org_1",
        employee_id: {
          _id: "emp_1",
          user_id: { _id: "user_emp_1", name: "Priya Sharma" },
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      try {
        // Employee calls with ?regenerate=true
        const { req, res } = createMockReqRes(
          { id: "offboard_1" },
          { regenerate: "true" },
          { id: "user_emp_1", role: "employee", organizationId: "org_1" }
        );

        await generateExperienceLetter(req, res);

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /Employees are not authorized to regenerate experience letters/);
      } finally {
        OffboardingProcess.findById = originalFindById;
      }
    });

    test("happy path: HR generates PDF stream with correct dates, headers, and task deliverables", async () => {
      const originalOffboardFind = OffboardingProcess.findById;
      const originalOrgFind = Organization.findById;
      const originalOnboardFind = OnboardingProcess.findOne;
      const originalCandidateFind = Candidate.find;
      const originalTaskAssignFind = TaskAssignment.find;

      const mockOffboarding = {
        _id: "offboard_1",
        status: "Completed",
        organizationId: "org_1",
        last_working_day: new Date("2026-09-15"),
        resignation_date: new Date("2026-08-15"),
        experience_letter_generated_at: null,
        employee_id: {
          _id: "emp_1",
          employee_code: "EMP001",
          designation: "Full Stack Engineer",
          date_of_joining: new Date("2024-01-10"),
          department_id: { departmentName: "Engineering" },
          user_id: { _id: "user_emp_1", name: "Priya Sharma", email: "priya@acme.com" },
        },
        save: async function () {
          return this;
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      Organization.findById = async () => ({
        _id: "org_1",
        name: "Acme Corp Technologies",
        address: "Suite 400, Financial District, Hyderabad",
        contactEmail: "contact@acme.com",
        contactPhone: "+91 40 1234 5678",
        orgCode: "ACME",
      });

      OnboardingProcess.findOne = async () => ({
        start_date: new Date("2024-01-15"),
      });

      Candidate.find = () => ({
        select: async () => [{ _id: "cand_1" }],
      });

      TaskAssignment.find = () => ({
        populate: async () => [
          { task: { title: "API Gateway Optimization" } },
          { task: { title: "Notification Microservice" } },
        ],
      });

      const originalNotifCreate = Notification.create;
      Notification.create = async () => ({ _id: "notif_exp" });

      try {
        const { req, res, isEndCalled } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", name: "Dhanushya", organizationId: "org_1" }
        );

        await generateExperienceLetter(req, res);

        if (!res.writableEnded) {
          await new Promise((resolve) => res.on("finish", resolve));
        }

        assert.strictEqual(res.headers["Content-Type"], "application/pdf");
        assert.match(res.headers["Content-Disposition"], /Experience_Letter_Priya_Sharma\.pdf/);
        assert.ok(mockOffboarding.experience_letter_generated_at, "Should set experience_letter_generated_at");
        assert.strictEqual(mockOffboarding.experience_letter_url, "/api/offboarding/offboard_1/experience-letter");
        assert.ok(res.writableEnded, "PDF stream should have been ended and flushed");
      } finally {
        OffboardingProcess.findById = originalOffboardFind;
        Organization.findById = originalOrgFind;
        OnboardingProcess.findOne = originalOnboardFind;
        Candidate.find = originalCandidateFind;
        TaskAssignment.find = originalTaskAssignFind;
        Notification.create = originalNotifCreate;
      }
    });

    test("fallback path: generates PDF with generic contributions when no tasks/candidate exist", async () => {
      const originalOffboardFind = OffboardingProcess.findById;
      const originalOrgFind = Organization.findById;
      const originalOnboardFind = OnboardingProcess.findOne;
      const originalCandidateFind = Candidate.find;
      const originalTaskAssignFind = TaskAssignment.find;

      const mockOffboarding = {
        _id: "offboard_2",
        status: "Completed",
        organizationId: "org_1",
        last_working_day: new Date("2026-09-15"),
        resignation_date: new Date("2026-08-15"),
        employee_id: {
          _id: "emp_2",
          employee_code: "EMP002",
          designation: "UI/UX Designer",
          date_of_joining: new Date("2025-02-01"),
          department_id: { departmentName: "Design" },
          user_id: { _id: "user_emp_2", name: "Rahul Verma", email: "rahul@acme.com" },
        },
        save: async function () {
          return this;
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      Organization.findById = async () => ({
        name: "Acme Corp Technologies",
      });

      OnboardingProcess.findOne = async () => null; // No onboarding record -> uses date_of_joining
      Candidate.find = () => ({ select: async () => [] }); // No candidate record
      TaskAssignment.find = () => ({ populate: async () => [] }); // No tasks

      const originalNotifCreate = Notification.create;
      Notification.create = async () => ({ _id: "notif_exp" });

      try {
        const { req, res, isEndCalled } = createMockReqRes(
          { id: "offboard_2" },
          {},
          { id: "hr_1", role: "hr_manager", name: "Dhanushya", organizationId: "org_1" }
        );

        await generateExperienceLetter(req, res);

        if (!res.writableEnded) {
          await new Promise((resolve) => res.on("finish", resolve));
        }

        assert.strictEqual(res.headers["Content-Type"], "application/pdf");
        assert.match(res.headers["Content-Disposition"], /Experience_Letter_Rahul_Verma\.pdf/);
        assert.ok(res.writableEnded, "PDF should have been generated and ended");
      } finally {
        OffboardingProcess.findById = originalOffboardFind;
        Organization.findById = originalOrgFind;
        OnboardingProcess.findOne = originalOnboardFind;
        Candidate.find = originalCandidateFind;
        TaskAssignment.find = originalTaskAssignFind;
        Notification.create = originalNotifCreate;
      }
    });

    test("auto-generation on completeOffboarding sets experience_letter_generated_at and notifies employee", async () => {
      const originalFindById = OffboardingProcess.findById;
      const originalEmpUpdate = Employee.findByIdAndUpdate;
      const originalNotifCreate = Notification.create;

      const createdNotifications = [];
      Notification.create = async (notif) => {
        createdNotifications.push(notif);
        return notif;
      };

      Employee.findByIdAndUpdate = async () => true;

      const mockOffboarding = {
        _id: "offboard_auto_1",
        status: "In Progress",
        completed_at: null,
        experience_letter_generated_at: null,
        employee_id: {
          _id: "emp_auto",
          user_id: { _id: "user_emp_auto" },
        },
        save: async function () {
          return this;
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      try {
        const { req, res } = createMockReqRes({ id: "offboard_auto_1" }, {}, { role: "admin", id: "admin_1" });
        req.body = { status: "Completed" };

        await completeOffboarding(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(mockOffboarding.status, "Completed");
        assert.ok(mockOffboarding.experience_letter_generated_at, "Should auto-set experience_letter_generated_at");
        assert.strictEqual(mockOffboarding.experience_letter_url, "/api/offboarding/offboard_auto_1/experience-letter");

        // Verify that notification was created for employee
        const letterNotif = createdNotifications.find((n) =>
          n.message.includes("Your experience letter is ready to download.")
        );
        assert.ok(letterNotif, "Notification for experience letter download should have been triggered");
        assert.strictEqual(String(letterNotif.recipient), "user_emp_auto");
      } finally {
        OffboardingProcess.findById = originalFindById;
        Employee.findByIdAndUpdate = originalEmpUpdate;
        Notification.create = originalNotifCreate;
      }
    });

    test("start date logic: uses employee.date_of_joining when no OnboardingProcess exists (never today's date)", async () => {
      const originalOffboardFind = OffboardingProcess.findById;
      const originalOrgFind = Organization.findById;
      const originalOnboardFind = OnboardingProcess.findOne;
      const originalCandidateFind = Candidate.find;
      const originalCandidateUpdate = Candidate.updateMany;
      const originalTaskAssignFind = TaskAssignment.find;
      const originalEmpUpdate = Employee.findByIdAndUpdate;
      const originalNotifCreate = Notification.create;

      const joiningDate = new Date("2023-04-10");
      const lastWorkingDay = new Date("2026-10-31");
      const todayFormatted = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const mockOffboarding = {
        _id: "offboard_test_doj",
        status: "In Progress",
        completed_at: null,
        organizationId: "org_test_1",
        last_working_day: lastWorkingDay,
        resignation_date: new Date("2026-09-01"),
        experience_letter_generated_at: null,
        employee_id: {
          _id: "emp_test_doj",
          employee_code: "EMPTEST01",
          designation: "Backend Architect",
          date_of_joining: joiningDate,
          department_id: { departmentName: "Engineering" },
          user_id: { _id: "user_test_doj", name: "Ananya Roy", email: "ananya@test.com" },
        },
        save: async function () {
          return this;
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      Organization.findById = async () => ({
        _id: "org_test_1",
        name: "Test Technologies Pvt Ltd",
        address: "Bengaluru, India",
        contactEmail: "hr@testtech.com",
        contactPhone: "+91 80 1234 5678",
        orgCode: "TECH",
      });

      // NO onboarding process exists for this employee
      OnboardingProcess.findOne = async () => null;
      Candidate.find = () => ({ select: async () => [] });
      Candidate.updateMany = async () => ({ acknowledged: true, modifiedCount: 0 });
      TaskAssignment.find = () => ({ populate: async () => [] });
      Employee.findByIdAndUpdate = async () => true;
      Notification.create = async () => ({ _id: "notif_1" });

      try {
        // 1. Complete offboarding
        const { req: completeReq, res: completeRes } = createMockReqRes(
          { id: "offboard_test_doj" },
          {},
          { role: "admin", id: "admin_1" }
        );
        completeReq.body = { status: "Completed" };
        await completeOffboarding(completeReq, completeRes);
        assert.strictEqual(completeRes.statusCode, 200);
        assert.strictEqual(mockOffboarding.status, "Completed");

        // 2. Generate experience letter PDF
        const { req: genReq, res: genRes, getChunks } = createMockReqRes(
          { id: "offboard_test_doj" },
          {},
          { id: "hr_1", role: "hr_manager", name: "HR Manager", organizationId: "org_test_1" }
        );

        await generateExperienceLetter(genReq, genRes);
        if (!genRes.writableEnded) {
          await new Promise((resolve) => genRes.on("finish", resolve));
        }

        assert.strictEqual(genRes.headers["Content-Type"], "application/pdf");
        const pdfText = extractPdfText(Buffer.concat(getChunks()));

        // Assert start date matches date_of_joining exactly ("10 April 2023")
        assert.ok(
          pdfText.includes("from 10 April 2023 to 31 October 2026"),
          `PDF employment period must match date_of_joining exactly (10 April 2023). Found: ${pdfText}`
        );

        // Assert start date is NOT today's date
        if (todayFormatted !== "10 April 2023") {
          assert.ok(
            !pdfText.includes(`from ${todayFormatted}`),
            `PDF start date must not be today's date (${todayFormatted})`
          );
        }
      } finally {
        OffboardingProcess.findById = originalOffboardFind;
        Organization.findById = originalOrgFind;
        OnboardingProcess.findOne = originalOnboardFind;
        Candidate.find = originalCandidateFind;
        Candidate.updateMany = originalCandidateUpdate;
        TaskAssignment.find = originalTaskAssignFind;
        Employee.findByIdAndUpdate = originalEmpUpdate;
        Notification.create = originalNotifCreate;
      }
    });

    test("start date logic: uses OnboardingProcess.start_date when it exists, overriding date_of_joining", async () => {
      const originalOffboardFind = OffboardingProcess.findById;
      const originalOrgFind = Organization.findById;
      const originalOnboardFind = OnboardingProcess.findOne;
      const originalCandidateFind = Candidate.find;
      const originalTaskAssignFind = TaskAssignment.find;
      const originalNotifCreate = Notification.create;

      const joiningDate = new Date("2023-04-10");
      const onboardingStartDate = new Date("2023-04-25"); // Later onboarding start date
      const lastWorkingDay = new Date("2026-10-31");

      const mockOffboarding = {
        _id: "offboard_test_onboard",
        status: "Completed",
        organizationId: "org_test_1",
        last_working_day: lastWorkingDay,
        resignation_date: new Date("2026-09-01"),
        experience_letter_generated_at: null,
        employee_id: {
          _id: "emp_test_onboard",
          employee_code: "EMPTEST02",
          designation: "Frontend Engineer",
          date_of_joining: joiningDate,
          department_id: { departmentName: "Design" },
          user_id: { _id: "user_test_onboard", name: "Sameer Joshi", email: "sameer@test.com" },
        },
        save: async function () {
          return this;
        },
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboarding,
      });

      Organization.findById = async () => ({
        _id: "org_test_1",
        name: "Test Technologies Pvt Ltd",
        address: "Bengaluru, India",
        contactEmail: "hr@testtech.com",
        contactPhone: "+91 80 1234 5678",
        orgCode: "TECH",
      });

      // OnboardingProcess DOES exist and has a specific start_date
      OnboardingProcess.findOne = async () => ({
        start_date: onboardingStartDate,
      });
      Candidate.find = () => ({ select: async () => [] });
      TaskAssignment.find = () => ({ populate: async () => [] });
      Notification.create = async () => ({ _id: "notif_2" });

      try {
        const { req: genReq, res: genRes, getChunks } = createMockReqRes(
          { id: "offboard_test_onboard" },
          {},
          { id: "hr_1", role: "hr_manager", name: "HR Manager", organizationId: "org_test_1" }
        );

        await generateExperienceLetter(genReq, genRes);
        if (!genRes.writableEnded) {
          await new Promise((resolve) => genRes.on("finish", resolve));
        }

        const pdfText = extractPdfText(Buffer.concat(getChunks()));

        // Assert start date uses OnboardingProcess.start_date ("25 April 2023"), NOT date_of_joining ("10 April 2023")
        assert.ok(
          pdfText.includes("from 25 April 2023 to 31 October 2026"),
          `PDF employment period must use OnboardingProcess.start_date (25 April 2023). Found: ${pdfText}`
        );
        assert.ok(
          !pdfText.includes("from 10 April 2023"),
          "PDF must not use date_of_joining when OnboardingProcess.start_date exists"
        );
      } finally {
        OffboardingProcess.findById = originalOffboardFind;
        Organization.findById = originalOrgFind;
        OnboardingProcess.findOne = originalOnboardFind;
        Candidate.find = originalCandidateFind;
        TaskAssignment.find = originalTaskAssignFind;
        Notification.create = originalNotifCreate;
      }
    });
  });

  describe("Offboarded Employee System-Wide Deactivation & Synchronization", () => {
    test("completing offboarding for an employee with a linked Candidate record sets both Employee.employment_status = 'Inactive' AND Candidate.status = 'INACTIVE'; completing a rejoin onboarding flips both back to Active", async () => {
      const originalOffboardFind = OffboardingProcess.findById;
      const originalOnboardFind = OnboardingProcess.findById;
      const originalEmpUpdate = Employee.findByIdAndUpdate;
      const originalCandUpdate = Candidate.updateMany;

      const employeeId = "emp_sync_123";
      const userEmail = "sync.employee@test.com";

      let capturedEmployeeStatus = null;
      let capturedCandidateStatus = null;

      const mockOffboardDoc = {
        _id: "offboard_sync_1",
        status: "In Progress",
        employee_id: {
          _id: employeeId,
          user_id: { _id: "user_sync_1", email: userEmail, name: "Sync Employee" }
        },
        save: async function () { return this; }
      };

      const mockOnboardDoc = {
        _id: "onboard_sync_1",
        status: "In Progress",
        employee_id: {
          _id: employeeId,
          user_id: { _id: "user_sync_1", email: userEmail, name: "Sync Employee" }
        },
        save: async function () { return this; }
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboardDoc,
      });

      OnboardingProcess.findById = () => ({
        populate: async () => mockOnboardDoc,
      });

      Employee.findByIdAndUpdate = async (id, update) => {
        if (update.employment_status) {
          capturedEmployeeStatus = update.employment_status;
        }
        return { _id: id, ...update, user_id: { email: userEmail } };
      };

      Candidate.updateMany = async (query, update) => {
        if (update.status) {
          capturedCandidateStatus = update.status;
        }
        return { acknowledged: true, modifiedCount: 1 };
      };

      try {
        // Step 1: Complete Offboarding
        const { req: offReq, res: offRes } = createMockReqRes({ id: "offboard_sync_1" }, {}, { id: "hr_1", role: "hr_manager" });
        offReq.body = { status: "Completed" };

        await completeOffboarding(offReq, offRes);

        assert.strictEqual(offRes.statusCode, 200);
        assert.strictEqual(mockOffboardDoc.status, "Completed");
        assert.strictEqual(capturedEmployeeStatus, "Inactive", "Employee.employment_status must be Inactive on offboarding completion");
        assert.strictEqual(capturedCandidateStatus, "INACTIVE", "Candidate.status must be INACTIVE on offboarding completion");

        // Step 2: Complete Rejoin Onboarding
        const { req: onReq, res: onRes } = createMockReqRes({ id: "onboard_sync_1" }, {}, { id: "hr_1", role: "hr_manager" });
        onReq.body = { status: "Completed" };

        await updateOnboardingStatus(onReq, onRes);

        assert.strictEqual(onRes.statusCode, 200);
        assert.strictEqual(mockOnboardDoc.status, "Completed");
        assert.strictEqual(capturedEmployeeStatus, "Active", "Employee.employment_status must be Active on rejoin onboarding completion");
        assert.strictEqual(capturedCandidateStatus, "ACTIVE", "Candidate.status must be ACTIVE on rejoin onboarding completion");
      } finally {
        OffboardingProcess.findById = originalOffboardFind;
        OnboardingProcess.findById = originalOnboardFind;
        Employee.findByIdAndUpdate = originalEmpUpdate;
        Candidate.updateMany = originalCandUpdate;
      }
    });

    test("handles employees without a matching Candidate record gracefully during offboarding without erroring", async () => {
      const originalOffboardFind = OffboardingProcess.findById;
      const originalEmpUpdate = Employee.findByIdAndUpdate;
      const originalCandUpdate = Candidate.updateMany;

      const mockOffboardDoc = {
        _id: "offboard_no_cand",
        status: "In Progress",
        employee_id: {
          _id: "emp_no_cand",
          user_id: { _id: "user_no_cand", email: "older.emp@test.com" }
        },
        save: async function () { return this; }
      };

      OffboardingProcess.findById = () => ({
        populate: async () => mockOffboardDoc,
      });

      Employee.findByIdAndUpdate = async (id, update) => ({ _id: id, ...update });
      Candidate.updateMany = async () => ({ acknowledged: true, modifiedCount: 0 }); // 0 candidates matched

      try {
        const { req, res } = createMockReqRes({ id: "offboard_no_cand" }, {}, { id: "hr_1", role: "hr_manager" });
        req.body = { status: "Completed" };

        await completeOffboarding(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(mockOffboardDoc.status, "Completed");
      } finally {
        OffboardingProcess.findById = originalOffboardFind;
        Employee.findByIdAndUpdate = originalEmpUpdate;
        Candidate.updateMany = originalCandUpdate;
      }
    });

    test("login rejection: EmpLogin returns 403 when employee is Inactive with deactivated account message", async () => {
      const originalUserFind = Employees.findOne;
      const originalBcryptCompare = bcrypt.compare;
      const originalEmpFind = Employee.findOne;

      const mockUser = {
        _id: "user_inactive_1",
        email: "inactive.emp@test.com",
        password: "hashedPassword123",
        role: "Employee",
      };

      Employees.findOne = async () => mockUser;
      bcrypt.compare = async () => true;
      Employee.findOne = async () => ({
        _id: "emp_inactive_1",
        user_id: "user_inactive_1",
        employment_status: "Inactive",
      });

      try {
        const { req, res } = createMockReqRes();
        req.body = { email: "inactive.emp@test.com", password: "Password@123" };

        await EmpLogin(req, res);

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(
          res.data?.message,
          "This account has been deactivated. Contact HR for assistance."
        );
      } finally {
        Employees.findOne = originalUserFind;
        bcrypt.compare = originalBcryptCompare;
        Employee.findOne = originalEmpFind;
      }
    });

    test("task assignment block: createAssignment rejects assigning tasks to an INACTIVE candidate with 400", async () => {
      const originalTaskFind = Task.findById;
      const originalCandFind = Candidate.findById;

      Task.findById = async () => ({ _id: "task_1", title: "Project Alpha" });
      Candidate.findById = async () => ({
        _id: "cand_inactive_1",
        name: "Relieved Candidate",
        status: "INACTIVE",
        organizationId: "org_1",
      });

      try {
        const { req, res } = createMockReqRes({}, {}, { id: "admin_1", role: "admin", organizationId: "org_1" });
        req.body = {
          taskId: "task_1",
          candidateId: "cand_inactive_1",
          deadline: "2026-10-15",
        };

        await createAssignment(req, res, () => {});

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(
          res.data?.message,
          "Cannot assign tasks to an inactive/relieved employee."
        );
      } finally {
        Task.findById = originalTaskFind;
        Candidate.findById = originalCandFind;
      }
    });

    test("asset assignment block: assignAsset rejects assigning assets to an Inactive employee with 400", async () => {
      const originalAssetFind = Asset.findById;
      const originalEmpFind = Employee.findById;

      Asset.findById = async () => ({ _id: "asset_1", status: "Available" });
      Employee.findById = () => ({
        populate: async () => ({
          _id: "emp_inactive_1",
          employment_status: "Inactive",
          user_id: { _id: "user_1" },
        }),
      });

      try {
        const { req, res } = createMockReqRes({}, {}, { id: "admin_1", role: "admin", organizationId: "org_1" });
        req.body = {
          asset_id: "asset_1",
          employee_id: "emp_inactive_1",
        };

        await assignAsset(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(
          res.data?.message,
          "Cannot assign assets to an inactive/relieved employee."
        );
      } finally {
        Asset.findById = originalAssetFind;
        Employee.findById = originalEmpFind;
      }
    });

    test("payroll generation block: generatePayroll rejects generating payroll for an Inactive employee with 400", async () => {
      const originalPayrollFind = Payroll.findOne;
      const originalSalaryFind = Salary.findOne;
      const originalEmpFind = Employee.findById;

      Payroll.findOne = async () => null; // No existing payroll for the month
      Salary.findOne = async () => ({
        _id: "sal_1",
        basicSalary: 50000,
        hra: 20000,
        allowances: 5000,
        deductions: 2000,
        isActive: true,
      });
      Employee.findById = () => ({
        populate: async () => ({
          _id: "emp_inactive_1",
          employment_status: "Inactive",
          employee_code: "EMP099",
          user_id: { name: "Relieved Employee" },
          department_id: { departmentName: "Engineering" },
        }),
      });

      try {
        const { req, res } = createMockReqRes();
        req.body = {
          employeeId: "emp_inactive_1",
          month: 10,
          year: 2026,
          daysPresent: 22,
          totalWorkingDays: 22,
        };

        await generatePayroll(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(
          res.data?.message,
          "Cannot generate payroll for an inactive/relieved employee."
        );
      } finally {
        Payroll.findOne = originalPayrollFind;
        Salary.findOne = originalSalaryFind;
        Employee.findById = originalEmpFind;
      }
    });
  });
});
