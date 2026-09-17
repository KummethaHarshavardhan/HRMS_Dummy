import { describe, test } from "node:test";
import assert from "node:assert";
import { Writable } from "node:stream";
import OffboardingProcess from "../models/OffboardingProcess.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import Payroll from "../models/Payroll.js";
import Document from "../models/Document.js";
import AssetAssignment from "../models/AssetAssignment.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import {
  getExitPackageDetails,
  downloadAttendanceSummary,
  downloadLeaveSummary,
  downloadNoDuesCertificate,
  downloadRelievingLetter,
} from "../controllers/offboardingController.js";
import {
  createNoDuesCertificatePDF,
  createRelievingLetterPDF,
  createAttendanceSummaryPDF,
  createLeaveSummaryPDF,
} from "../services/exitDocumentService.js";

// Helper to mock express req and res
const createMockReqRes = (params = {}, query = {}, user = {}, body = {}) => {
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
    body,
  };

  return {
    req,
    res,
    getChunks: () => chunks,
    isEndCalled: () => endCalled,
    getBuffer: () => Buffer.concat(chunks),
  };
};

describe("Exit Documents Package - Controller & Service Tests", () => {
  const mockOrg = {
    _id: "org_1",
    name: "Spaxiox Technologies",
    address: "Tech Park, Hyderabad",
    email: "hr@spaxiox.com",
    phone: "+91 9876543210",
  };

  const mockEmployee = {
    _id: "emp_1",
    employee_code: "EMP001",
    date_of_joining: new Date("2024-01-15"),
    designation: "Software Engineer",
    organizationId: "org_1",
    user_id: {
      _id: "user_1",
      name: "Rohan Varma",
      email: "rohan@example.com",
    },
    department_id: {
      name: "Engineering",
    },
  };

  const mockOffboardingCompleteClearance = {
    _id: "offboard_1",
    status: "Completed",
    organizationId: mockOrg,
    employee_id: mockEmployee,
    resignation_date: new Date("2026-08-01"),
    last_working_day: new Date("2026-09-01"),
    reason: "Better opportunity",
    clearance_status: {
      hr: { signed: true, signed_at: new Date() },
      it: { signed: true, signed_at: new Date() },
      finance: { signed: true, signed_at: new Date() },
      manager: { signed: true, signed_at: new Date() },
    },
    createdAt: new Date("2026-08-05"),
  };

  describe("1. Access Controls & Multi-Tenancy", () => {
    test("rejects super_admin with 403", async () => {
      const { req, res } = createMockReqRes({ id: "offboard_1" }, {}, { role: "super_admin" });
      await getExitPackageDetails(req, res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Super Admin is not authorized/);
    });

    test("rejects access if offboarding record is not found (404)", async () => {
      const origFindById = OffboardingProcess.findById;
      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => null,
          }),
        });

        const { req, res } = createMockReqRes(
          { id: "offboard_nonexistent" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );
        await getExitPackageDetails(req, res);
        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(res.data.success, false);
      } finally {
        OffboardingProcess.findById = origFindById;
      }
    });

    test("rejects HR from different organization with 403", async () => {
      const origFindById = OffboardingProcess.findById;
      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        const { req, res } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_diff", role: "hr_manager", organizationId: "org_DIFFERENT" }
        );
        await getExitPackageDetails(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert.match(res.data.message, /unauthorized organization/);
      } finally {
        OffboardingProcess.findById = origFindById;
      }
    });
  });

  describe("2. getExitPackageDetails", () => {
    test("returns full exit package data (payslips, finalPayslip, eligibility, otherDocs)", async () => {
      const origFindById = OffboardingProcess.findById;
      const origPayrollFind = Payroll.find;
      const origAssetFind = AssetAssignment.find;
      const origDocFind = Document.find;
      const origOnboardingFindOne = OnboardingProcess.findOne;

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        Payroll.find = () => ({
          sort: async () => [
            {
              _id: "pay_2",
              month: "August",
              year: 2026,
              netSalary: 75000,
              basicSalary: 50000,
              status: "Paid",
              paymentDate: new Date("2026-08-31"),
            },
            {
              _id: "pay_1",
              month: "July",
              year: 2026,
              netSalary: 75000,
              basicSalary: 50000,
              status: "Paid",
              paymentDate: new Date("2026-07-31"),
            },
          ],
        });

        // 0 active assets
        AssetAssignment.find = async () => [];

        // Other documents
        Document.find = () => ({
          sort: async () => [
            {
              _id: "doc_1",
              title: "Handover Notes",
              category: "Other",
              document_url: "https://example.com/handover.pdf",
              createdAt: new Date("2026-08-25"),
            },
          ],
        });

        OnboardingProcess.findOne = () => ({
          sort: async () => ({
            start_date: new Date("2024-01-15"),
          }),
        });

        const { req, res } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await getExitPackageDetails(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.data.payslips.length, 2);
        assert.strictEqual(res.data.data.finalPayslip._id, "pay_2");
        assert.strictEqual(res.data.data.activeAssetCount, 0);
        assert.strictEqual(res.data.data.isClearanceComplete, true);
        assert.strictEqual(res.data.data.noDuesEligible, true);
        assert.strictEqual(res.data.data.otherDocuments.length, 1);
        assert.strictEqual(res.data.data.tenure.startDate.toISOString(), new Date("2024-01-15").toISOString());
      } finally {
        OffboardingProcess.findById = origFindById;
        Payroll.find = origPayrollFind;
        AssetAssignment.find = origAssetFind;
        Document.find = origDocFind;
        OnboardingProcess.findOne = origOnboardingFindOne;
      }
    });

    test("computes noDuesEligible as false when employee has unreturned assets", async () => {
      const origFindById = OffboardingProcess.findById;
      const origPayrollFind = Payroll.find;
      const origAssetFind = AssetAssignment.find;
      const origDocFind = Document.find;
      const origOnboardingFindOne = OnboardingProcess.findOne;

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        Payroll.find = () => ({ sort: async () => [] });
        // 1 active asset still held
        AssetAssignment.find = async () => [{ _id: "asset_assign_1", status: "Active" }];
        Document.find = () => ({ sort: async () => [] });
        OnboardingProcess.findOne = () => ({ sort: async () => null });

        const { req, res } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await getExitPackageDetails(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.data.activeAssetCount, 1);
        assert.strictEqual(res.data.data.isClearanceComplete, true);
        assert.strictEqual(res.data.data.noDuesEligible, false);
      } finally {
        OffboardingProcess.findById = origFindById;
        Payroll.find = origPayrollFind;
        AssetAssignment.find = origAssetFind;
        Document.find = origDocFind;
        OnboardingProcess.findOne = origOnboardingFindOne;
      }
    });
  });

  describe("3. downloadNoDuesCertificate", () => {
    test("blocks generation with 400 if active assets exist", async () => {
      const origFindById = OffboardingProcess.findById;
      const origAssetFind = AssetAssignment.find;

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        AssetAssignment.find = async () => [{ _id: "asset_assign_1", status: "Active" }];

        const { req, res } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await downloadNoDuesCertificate(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.data.success, false);
        assert.strictEqual(res.data.activeAssetCount, 1);
        assert.match(res.data.message, /unreturned company assets/);
      } finally {
        OffboardingProcess.findById = origFindById;
        AssetAssignment.find = origAssetFind;
      }
    });

    test("blocks generation with 400 if department clearance is incomplete", async () => {
      const origFindById = OffboardingProcess.findById;
      const origAssetFind = AssetAssignment.find;

      const mockIncompleteOffboard = {
        ...mockOffboardingCompleteClearance,
        clearance_status: {
          hr: { signed: true },
          it: { signed: true },
          finance: { signed: false }, // missing finance sign-off
          manager: { signed: true },
        },
      };

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockIncompleteOffboard,
          }),
        });

        AssetAssignment.find = async () => [];

        const { req, res } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await downloadNoDuesCertificate(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.data.success, false);
        assert.strictEqual(res.data.isClearanceComplete, false);
      } finally {
        OffboardingProcess.findById = origFindById;
        AssetAssignment.find = origAssetFind;
      }
    });

    test("generates and streams valid PDF when eligible", async () => {
      const origFindById = OffboardingProcess.findById;
      const origAssetFind = AssetAssignment.find;

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        AssetAssignment.find = async () => [];

        const { req, res, getBuffer } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await downloadNoDuesCertificate(req, res);

        // Wait for stream to finish
        await new Promise((resolve) => setTimeout(resolve, 300));

        assert.strictEqual(res.headers["Content-Type"], "application/pdf");
        assert.match(res.headers["Content-Disposition"], /attachment; filename="No_Dues_Certificate_/);
        const buf = getBuffer();
        assert.ok(buf.length > 500, "PDF buffer should contain valid PDF data");
        assert.strictEqual(buf.slice(0, 4).toString(), "%PDF");
      } finally {
        OffboardingProcess.findById = origFindById;
        AssetAssignment.find = origAssetFind;
      }
    });
  });

  describe("4. downloadRelievingLetter", () => {
    test("generates and streams Relieving Letter PDF with Option A formal release terms", async () => {
      const origFindById = OffboardingProcess.findById;

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        const { req, res, getBuffer } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await downloadRelievingLetter(req, res);

        await new Promise((resolve) => setTimeout(resolve, 300));

        assert.strictEqual(res.headers["Content-Type"], "application/pdf");
        assert.match(res.headers["Content-Disposition"], /attachment; filename="Relieving_Letter_/);
        const buf = getBuffer();
        assert.ok(buf.length > 500, "PDF buffer should contain valid PDF data");
        assert.strictEqual(buf.slice(0, 4).toString(), "%PDF");
      } finally {
        OffboardingProcess.findById = origFindById;
      }
    });
  });

  describe("5. downloadAttendanceSummary & downloadLeaveSummary", () => {
    test("generates and streams Attendance Summary PDF", async () => {
      const origFindById = OffboardingProcess.findById;
      const origAttendanceFind = Attendance.find;
      const origOnboardingFindOne = OnboardingProcess.findOne;

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        OnboardingProcess.findOne = () => ({ sort: async () => ({ start_date: new Date("2024-01-15") }) });

        Attendance.find = () => ({
          sort: async () => [
            { date: new Date("2026-08-01"), status: "Present", workMode: "Office" },
            { date: new Date("2026-08-02"), status: "Late", workMode: "Office" },
            { date: new Date("2026-08-03"), status: "Half Day", workMode: "WFH" },
          ],
        });

        const { req, res, getBuffer } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await downloadAttendanceSummary(req, res);

        await new Promise((resolve) => setTimeout(resolve, 300));

        assert.strictEqual(res.headers["Content-Type"], "application/pdf");
        assert.match(res.headers["Content-Disposition"], /attachment; filename="Attendance_Summary_/);
        const buf = getBuffer();
        assert.ok(buf.length > 500, "PDF buffer should contain valid PDF data");
        assert.strictEqual(buf.slice(0, 4).toString(), "%PDF");
      } finally {
        OffboardingProcess.findById = origFindById;
        Attendance.find = origAttendanceFind;
        OnboardingProcess.findOne = origOnboardingFindOne;
      }
    });

    test("generates and streams Leave Summary PDF", async () => {
      const origFindById = OffboardingProcess.findById;
      const origLeaveFind = Leave.find;
      const origOnboardingFindOne = OnboardingProcess.findOne;

      try {
        OffboardingProcess.findById = () => ({
          populate: () => ({
            populate: async () => mockOffboardingCompleteClearance,
          }),
        });

        OnboardingProcess.findOne = () => ({ sort: async () => ({ start_date: new Date("2024-01-15") }) });

        Leave.find = () => ({
          sort: async () => [
            {
              type: "Annual Leave",
              startDate: new Date("2026-07-10"),
              endDate: new Date("2026-07-12"),
              reason: "Vacation",
              status: "Approved",
            },
            {
              type: "Sick Leave",
              startDate: new Date("2026-08-05"),
              endDate: new Date("2026-08-05"),
              reason: "Doctor appointment",
              status: "Approved",
            },
          ],
        });

        const { req, res, getBuffer } = createMockReqRes(
          { id: "offboard_1" },
          {},
          { id: "hr_1", role: "hr_manager", organizationId: "org_1" }
        );

        await downloadLeaveSummary(req, res);

        await new Promise((resolve) => setTimeout(resolve, 300));

        assert.strictEqual(res.headers["Content-Type"], "application/pdf");
        assert.match(res.headers["Content-Disposition"], /attachment; filename="Leave_Summary_/);
        const buf = getBuffer();
        assert.ok(buf.length > 500, "PDF buffer should contain valid PDF data");
        assert.strictEqual(buf.slice(0, 4).toString(), "%PDF");
      } finally {
        OffboardingProcess.findById = origFindById;
        Leave.find = origLeaveFind;
        OnboardingProcess.findOne = origOnboardingFindOne;
      }
    });
  });

  describe("6. Exit Document Service Direct Generators", () => {
    test("createNoDuesCertificatePDF returns a readable stream producing PDF bytes", async () => {
      const doc = createNoDuesCertificatePDF({
        offboarding: mockOffboardingCompleteClearance,
        employee: mockEmployee,
        organization: mockOrg,
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));

      await new Promise((resolve) => {
        doc.on("end", resolve);
        doc.end();
      });

      const buf = Buffer.concat(chunks);
      assert.strictEqual(buf.slice(0, 4).toString(), "%PDF");
      assert.ok(buf.length > 1000);
    });

    test("createRelievingLetterPDF returns a readable stream producing PDF bytes", async () => {
      const doc = createRelievingLetterPDF({
        offboarding: mockOffboardingCompleteClearance,
        employee: mockEmployee,
        organization: mockOrg,
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));

      await new Promise((resolve) => {
        doc.on("end", resolve);
        doc.end();
      });

      const buf = Buffer.concat(chunks);
      assert.strictEqual(buf.slice(0, 4).toString(), "%PDF");
      assert.ok(buf.length > 1000);
    });
  });
});
