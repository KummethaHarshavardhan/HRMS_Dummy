import { describe, test } from "node:test";
import assert from "node:assert";
import WFHRequest from "../models/WFHRequest.js";
import Employee from "../models/Employee.js";
import Notification from "../models/Notification.js";
import UserModel from "../models/UserModel.js";
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  decideRequest,
  downloadAttachment,
  withdrawRequest,
} from "../controllers/wfhController.js";
import {
  validateCreateWFHRequest,
  validateDecideWFHRequest,
} from "../validations/wfhValidation.js";
import {
  notifyWFHSubmission,
  notifyWFHDecision,
  notifyWFHWithdrawal,
} from "../services/notificationService.js";

// Non-blocking mocks for unit test environment without active DB connection
Notification.create = async (doc) => doc;
UserModel.find = () => ({
  select: async () => [],
});

// Helper to mock express req and res
const createMockReqRes = ({
  params = {},
  query = {},
  user = {},
  body = {},
  files = [],
} = {}) => {
  let statusCode = 200;
  let responseData = null;

  const res = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    status(code) {
      this.statusCode = code;
      statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      responseData = payload;
      this.headersSent = true;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };

  const req = {
    params,
    query,
    user,
    headers: {},
    body,
    files,
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
};

describe("Work From Home (WFH) Request Module - Unit Tests", () => {
  const orgA = "607f1f77bcf86cd799439011";
  const orgB = "607f1f77bcf86cd799439022";

  const mockEmployeeUser = {
    id: "607f1f77bcf86cd799439301",
    role: "employee",
    organizationId: orgA,
    name: "Kakarla Vijay",
    email: "vijay@spaxiox.com",
  };

  const mockOtherEmployeeUser = {
    id: "607f1f77bcf86cd799439302",
    role: "employee",
    organizationId: orgA,
    name: "Other Employee",
    email: "other@spaxiox.com",
  };

  const mockHrUserOrgA = {
    id: "607f1f77bcf86cd799439100",
    role: "hr_manager",
    organizationId: orgA,
    name: "Priya HR",
  };

  const mockAdminUserOrgA = {
    id: "607f1f77bcf86cd799439101",
    role: "admin",
    organizationId: orgA,
    name: "Amit Admin",
  };

  const mockSuperAdmin = {
    id: "607f1f77bcf86cd799439999",
    role: "super_admin",
    name: "Platform SuperAdmin",
  };

  const mockEmployeeRecord = {
    _id: "607f1f77bcf86cd799439501",
    employee_code: "EMP006",
    user_id: {
      _id: mockEmployeeUser.id,
      name: mockEmployeeUser.name,
      email: mockEmployeeUser.email,
    },
    organizationId: {
      _id: orgA,
      name: "Acme Corp",
    },
    department_id: {
      departmentName: "Engineering",
    },
  };

  // =========================================================================
  // 1. Validation Middleware Tests
  // =========================================================================
  describe("1. WFH Validation Middleware", () => {
    test("validateCreateWFHRequest: accepts valid start and end dates with reason", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes({
        body: {
          start_date: "2026-10-01",
          end_date: "2026-10-03",
          reason: "Attending family function and will work remotely",
        },
      });

      validateCreateWFHRequest(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.statusCode, 200);
    });

    test("validateCreateWFHRequest: rejects when end_date < start_date", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes({
        body: {
          start_date: "2026-10-05",
          end_date: "2026-10-02",
          reason: "Remote working",
        },
      });

      validateCreateWFHRequest(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /end_date cannot be earlier than start_date/i);
    });

    test("validateCreateWFHRequest: rejects when reason is empty or whitespace", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes({
        body: {
          start_date: "2026-10-01",
          end_date: "2026-10-02",
          reason: "   ",
        },
      });

      validateCreateWFHRequest(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /reason/i);
    });

    test("validateDecideWFHRequest: accepts Approved decision", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes({
        body: {
          decision: "Approved",
        },
      });

      validateDecideWFHRequest(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
    });

    test("validateDecideWFHRequest: requires rejection_reason when Rejected", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes({
        body: {
          decision: "Rejected",
          rejection_reason: "",
        },
      });

      validateDecideWFHRequest(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /rejection reason is required/i);
    });
  });

  // =========================================================================
  // 2. Employee Request Creation & Self-Service
  // =========================================================================
  describe("2. Employee WFH Request Submission & Retrieval", () => {
    test("createRequest: creates Pending WFHRequest for authenticated employee", async () => {
      const origFindOne = Employee.findOne;
      const origCreate = WFHRequest.create;

      let createdPayload = null;

      Employee.findOne = () => ({
        populate: () => ({
          populate: async () => mockEmployeeRecord,
        }),
      });

      WFHRequest.create = async (payload) => {
        createdPayload = payload;
        return {
          ...payload,
          _id: "607f1f77bcf86cd799439601",
          attached_files: (payload.attached_files || []).map((f) => ({ ...f })),
          save: async () => {},
        };
      };

      const { req, res } = createMockReqRes({
        user: mockEmployeeUser,
        body: {
          start_date: "2026-10-01",
          end_date: "2026-10-02",
          reason: "Focus work on quarterly deliverables",
        },
      });

      await createRequest(req, res);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(createdPayload.status, "Pending");
      assert.strictEqual(String(createdPayload.employee_id), String(mockEmployeeRecord._id));
      assert.strictEqual(String(createdPayload.organizationId), String(orgA));

      Employee.findOne = origFindOne;
      WFHRequest.create = origCreate;
    });

    test("getMyRequests: returns only requests for current employee", async () => {
      const origFindOne = Employee.findOne;
      const origFind = WFHRequest.find;

      Employee.findOne = async () => mockEmployeeRecord;

      let queriedFilter = null;
      WFHRequest.find = (filter) => {
        queriedFilter = filter;
        return {
          populate: () => ({
            sort: async () => [
              {
                _id: "607f1f77bcf86cd799439601",
                employee_id: mockEmployeeRecord._id,
                status: "Pending",
              },
            ],
          }),
        };
      };

      const { req, res } = createMockReqRes({
        user: mockEmployeeUser,
      });

      await getMyRequests(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.count, 1);
      assert.strictEqual(String(queriedFilter.employee_id), String(mockEmployeeRecord._id));

      Employee.findOne = origFindOne;
      WFHRequest.find = origFind;
    });
  });

  // =========================================================================
  // 3. Organization Scoping (HR read-only vs Super Admin global)
  // =========================================================================
  describe("3. List WFH Requests & Role Scoping", () => {
    test("getAllRequests: blocks standard employee with 403", async () => {
      const { req, res } = createMockReqRes({
        user: mockEmployeeUser,
      });

      await getAllRequests(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.data.message, /not authorized to view organization/i);
    });

    test("getAllRequests: strictly scopes HR Manager to own organizationId", async () => {
      const origFind = WFHRequest.find;
      let appliedQuery = null;

      WFHRequest.find = (query) => {
        appliedQuery = query;
        return {
          populate: () => ({
            populate: () => ({
              populate: () => ({
                sort: async () => [],
              }),
            }),
          }),
        };
      };

      const { req, res } = createMockReqRes({
        user: mockHrUserOrgA,
        query: { status: "Pending" },
      });

      await getAllRequests(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(String(appliedQuery.organizationId), String(orgA));
      assert.strictEqual(appliedQuery.status, "Pending");

      WFHRequest.find = origFind;
    });

    test("getAllRequests: allows Super Admin to query unscoped or across all orgs", async () => {
      const origFind = WFHRequest.find;
      let appliedQuery = null;

      WFHRequest.find = (query) => {
        appliedQuery = query;
        return {
          populate: () => ({
            populate: () => ({
              populate: () => ({
                sort: async () => [],
              }),
            }),
          }),
        };
      };

      const { req, res } = createMockReqRes({
        user: mockSuperAdmin,
        query: { status: "ALL" },
      });

      await getAllRequests(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(appliedQuery.organizationId, undefined, "Super Admin unscoped by default");

      WFHRequest.find = origFind;
    });
  });

  // =========================================================================
  // 4. Super Admin Sole Decision Authority
  // =========================================================================
  describe("4. Decision Authority (Super Admin ONLY)", () => {
    test("decideRequest: rejects Admin or HR Manager with 403 Forbidden", async () => {
      const { req: hrReq, res: hrRes } = createMockReqRes({
        user: mockHrUserOrgA,
        params: { id: "607f1f77bcf86cd799439601" },
        body: { decision: "Approved" },
      });

      await decideRequest(hrReq, hrRes);

      assert.strictEqual(hrRes.statusCode, 403);
      assert.match(hrRes.data.message, /only super admin is authorized/i);

      const { req: adminReq, res: adminRes } = createMockReqRes({
        user: mockAdminUserOrgA,
        params: { id: "607f1f77bcf86cd799439601" },
        body: { decision: "Approved" },
      });

      await decideRequest(adminReq, adminRes);

      assert.strictEqual(adminRes.statusCode, 403);
      assert.match(adminRes.data.message, /only super admin is authorized/i);
    });

    test("decideRequest: Super Admin can Approve a WFH request", async () => {
      const origFindById = WFHRequest.findById;

      const mockRequest = {
        _id: "607f1f77bcf86cd799439601",
        status: "Pending",
        employee_id: mockEmployeeRecord,
        start_date: new Date("2026-10-01"),
        end_date: new Date("2026-10-02"),
        save: async function () {
          return this;
        },
      };

      WFHRequest.findById = () => ({
        populate: async () => mockRequest,
      });

      const { req, res } = createMockReqRes({
        user: mockSuperAdmin,
        params: { id: "607f1f77bcf86cd799439601" },
        body: { decision: "Approved" },
      });

      await decideRequest(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(mockRequest.status, "Approved");
      assert.strictEqual(mockRequest.decided_by, mockSuperAdmin.id);
      assert.ok(mockRequest.decided_at instanceof Date);

      WFHRequest.findById = origFindById;
    });

    test("decideRequest: Super Admin can Reject a WFH request with rejection reason", async () => {
      const origFindById = WFHRequest.findById;

      const mockRequest = {
        _id: "607f1f77bcf86cd799439601",
        status: "Pending",
        employee_id: mockEmployeeRecord,
        start_date: new Date("2026-10-01"),
        end_date: new Date("2026-10-02"),
        save: async function () {
          return this;
        },
      };

      WFHRequest.findById = () => ({
        populate: async () => mockRequest,
      });

      const { req, res } = createMockReqRes({
        user: mockSuperAdmin,
        params: { id: "607f1f77bcf86cd799439601" },
        body: {
          decision: "Rejected",
          rejection_reason: "Critical on-site hardware deployment scheduled on these dates",
        },
      });

      await decideRequest(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(mockRequest.status, "Rejected");
      assert.strictEqual(mockRequest.decided_by, mockSuperAdmin.id);
      assert.strictEqual(
        mockRequest.rejection_reason,
        "Critical on-site hardware deployment scheduled on these dates"
      );

      WFHRequest.findById = origFindById;
    });
  });

  // =========================================================================
  // 5. Dual Notification Dispatch Tests
  // =========================================================================
  describe("5. WFH Notifications", () => {
    test("notifyWFHSubmission: sends notifications to both HR in org and Super Admins", async () => {
      const origUserFind = UserModel.find;
      const origCreateNotif = Notification.create;

      const dispatchedNotifications = [];

      UserModel.find = (filter) => {
        if (filter.organizationId) {
          // Return HR users in employee's org
          return {
            select: async () => [
              { _id: mockHrUserOrgA.id, role: "HR Manager" },
              { _id: mockAdminUserOrgA.id, role: "Admin" },
            ],
          };
        } else {
          // Return Super Admin users
          return {
            select: async () => [{ _id: mockSuperAdmin.id, role: "super_admin" }],
          };
        }
      };

      Notification.create = async (payload) => {
        dispatchedNotifications.push(payload);
        return payload;
      };

      await notifyWFHSubmission({
        employee: mockEmployeeRecord,
        organization: mockEmployeeRecord.organizationId,
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-03"),
      });

      // Should dispatch 2 to HR/Admin in org + 1 to Super Admin = 3 notifications
      assert.strictEqual(dispatchedNotifications.length, 3);
      assert.strictEqual(dispatchedNotifications[0].type, "wfh_requested");
      assert.match(dispatchedNotifications[0].message, /Kakarla Vijay from Acme Corp requested Work From Home/i);

      UserModel.find = origUserFind;
      Notification.create = origCreateNotif;
    });

    test("notifyWFHDecision: sends outcome notification to employee", async () => {
      const origCreateNotif = Notification.create;
      let sentNotification = null;

      Notification.create = async (payload) => {
        sentNotification = payload;
        return payload;
      };

      await notifyWFHDecision({
        employee: mockEmployeeRecord,
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-02"),
        decision: "Rejected",
        rejectionReason: "Client meeting on-site",
      });

      assert.ok(sentNotification);
      assert.strictEqual(sentNotification.type, "wfh_rejected");
      assert.strictEqual(String(sentNotification.recipient), String(mockEmployeeUser.id));
      assert.match(sentNotification.message, /was rejected\. Reason: Client meeting on-site/i);

      Notification.create = origCreateNotif;
    });
  });

  // =========================================================================
  // 6. Attachment Download Access Control (RBAC)
  // =========================================================================
  describe("6. Attachment Download Access Control", () => {
    test("downloadAttachment: blocks unrelated employee from downloading files", async () => {
      const origFindById = WFHRequest.findById;

      const mockRequest = {
        _id: "607f1f77bcf86cd799439601",
        organizationId: orgA,
        employee_id: {
          _id: mockEmployeeRecord._id,
          user_id: mockEmployeeUser.id,
        },
        attached_files: [
          {
            file_name: "doctor_note.pdf",
            stored_filename: "wfh-note-123.pdf",
            mime_type: "application/pdf",
          },
        ],
      };

      WFHRequest.findById = () => ({
        populate: async () => mockRequest,
      });

      const { req, res } = createMockReqRes({
        user: mockOtherEmployeeUser,
        params: { id: "607f1f77bcf86cd799439601", fileIndex: "0" },
      });

      await downloadAttachment(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.data.message, /access denied/i);

      WFHRequest.findById = origFindById;
    });
  });

  // =========================================================================
  // 7. WFH Request Withdrawal (Self-Service)
  // =========================================================================
  describe("7. WFH Request Withdrawal (Self-Service)", () => {
    test("Employee can withdraw their own Pending request; status becomes Withdrawn with a timestamp", async () => {
      const origFindById = WFHRequest.findById;

      const mockRequest = {
        _id: "607f1f77bcf86cd799439601",
        status: "Pending",
        employee_id: mockEmployeeRecord,
        organizationId: { _id: orgA, name: "Acme Corp" },
        start_date: new Date("2026-10-01"),
        end_date: new Date("2026-10-02"),
        withdrawn_at: null,
        save: async function () {
          return this;
        },
      };

      WFHRequest.findById = () => ({
        populate: () => ({
          populate: async () => mockRequest,
        }),
      });

      const { req, res } = createMockReqRes({
        user: mockEmployeeUser,
        params: { id: "607f1f77bcf86cd799439601" },
      });

      await withdrawRequest(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(mockRequest.status, "Withdrawn");
      assert.ok(mockRequest.withdrawn_at instanceof Date);
      assert.match(res.data.message, /withdrawn successfully/i);

      WFHRequest.findById = origFindById;
    });

    test("Employee cannot withdraw another employee's request (403)", async () => {
      const origFindById = WFHRequest.findById;

      const mockRequest = {
        _id: "607f1f77bcf86cd799439601",
        status: "Pending",
        employee_id: mockEmployeeRecord, // owned by mockEmployeeUser
        organizationId: { _id: orgA, name: "Acme Corp" },
        start_date: new Date("2026-10-01"),
        end_date: new Date("2026-10-02"),
        save: async function () {
          return this;
        },
      };

      WFHRequest.findById = () => ({
        populate: () => ({
          populate: async () => mockRequest,
        }),
      });

      const { req, res } = createMockReqRes({
        user: mockOtherEmployeeUser, // different user
        params: { id: "607f1f77bcf86cd799439601" },
      });

      await withdrawRequest(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /only the employee who submitted this request can withdraw it/i);

      WFHRequest.findById = origFindById;
    });

    test("Employee cannot withdraw a request that is already Approved or Rejected (400)", async () => {
      const origFindById = WFHRequest.findById;

      const testStatuses = ["Approved", "Rejected", "Withdrawn"];

      for (const nonPendingStatus of testStatuses) {
        const mockRequest = {
          _id: "607f1f77bcf86cd799439601",
          status: nonPendingStatus,
          employee_id: mockEmployeeRecord,
          organizationId: { _id: orgA, name: "Acme Corp" },
          save: async function () {
            return this;
          },
        };

        WFHRequest.findById = () => ({
          populate: () => ({
            populate: async () => mockRequest,
          }),
        });

        const { req, res } = createMockReqRes({
          user: mockEmployeeUser,
          params: { id: "607f1f77bcf86cd799439601" },
        });

        await withdrawRequest(req, res);

        assert.strictEqual(res.statusCode, 400, `Expected 400 when status is ${nonPendingStatus}`);
        assert.strictEqual(res.data.success, false);
        assert.strictEqual(res.data.message, "Only pending requests can be withdrawn");
      }

      WFHRequest.findById = origFindById;
    });

    test("HR/admin and super_admin get 403 if they try to call the withdraw endpoint (self-service only)", async () => {
      const staffUsers = [mockHrUserOrgA, mockAdminUserOrgA, mockSuperAdmin];

      for (const staffUser of staffUsers) {
        const { req, res } = createMockReqRes({
          user: staffUser,
          params: { id: "607f1f77bcf86cd799439601" },
        });

        await withdrawRequest(req, res);

        assert.strictEqual(res.statusCode, 403, `Expected 403 for role ${staffUser.role}`);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /only the employee who submitted this request can withdraw it/i);
      }
    });

    test("Withdrawing a request removes it from super_admin's default Pending queue but it remains visible under an All/Withdrawn filter", async () => {
      const origFind = WFHRequest.find;
      const capturedQueries = [];

      WFHRequest.find = (query) => {
        capturedQueries.push(query);
        return {
          populate: () => ({
            populate: () => ({
              populate: () => ({
                sort: async () => [],
              }),
            }),
          }),
        };
      };

      // 1. Default Super Admin view filtering by status = "Pending"
      const { req: pendingReq, res: pendingRes } = createMockReqRes({
        user: mockSuperAdmin,
        query: { status: "Pending" },
      });
      await getAllRequests(pendingReq, pendingRes);
      assert.strictEqual(pendingRes.statusCode, 200);
      assert.strictEqual(capturedQueries[0].status, "Pending", "Pending queue strictly matches status: Pending");

      // 2. View under "ALL" filter (should not filter out Withdrawn)
      const { req: allReq, res: allRes } = createMockReqRes({
        user: mockSuperAdmin,
        query: { status: "ALL" },
      });
      await getAllRequests(allReq, allRes);
      assert.strictEqual(allRes.statusCode, 200);
      assert.strictEqual(capturedQueries[1].status, undefined, "ALL filter does not restrict status");

      // 3. View under "Withdrawn" filter
      const { req: withdrawnReq, res: withdrawnRes } = createMockReqRes({
        user: mockSuperAdmin,
        query: { status: "Withdrawn" },
      });
      await getAllRequests(withdrawnReq, withdrawnRes);
      assert.strictEqual(withdrawnRes.statusCode, 200);
      assert.strictEqual(capturedQueries[2].status, "Withdrawn", "Withdrawn filter explicitly filters by Withdrawn");

      WFHRequest.find = origFind;
    });

    test("Notification fires to HR/admin and super_admin on withdrawal", async () => {
      const origUserFind = UserModel.find;
      const origCreateNotif = Notification.create;

      const dispatchedNotifications = [];

      UserModel.find = (filter) => {
        if (filter.organizationId) {
          // Return HR & Admin users in employee's org
          return {
            select: async () => [
              { _id: mockHrUserOrgA.id, role: "HR Manager" },
              { _id: mockAdminUserOrgA.id, role: "Admin" },
            ],
          };
        } else {
          // Return Super Admin users
          return {
            select: async () => [{ _id: mockSuperAdmin.id, role: "super_admin" }],
          };
        }
      };

      Notification.create = async (payload) => {
        dispatchedNotifications.push(payload);
        return payload;
      };

      await notifyWFHWithdrawal({
        employee: mockEmployeeRecord,
        organization: mockEmployeeRecord.organizationId,
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-03"),
      });

      // Should dispatch 2 to HR/Admin in org + 1 to Super Admin = 3 notifications
      assert.strictEqual(dispatchedNotifications.length, 3);
      assert.strictEqual(dispatchedNotifications[0].type, "wfh_withdrawn");
      assert.match(
        dispatchedNotifications[0].message,
        /Kakarla Vijay withdrew their WFH request for Oct 1, 2026 to Oct 3, 2026\./i
      );

      UserModel.find = origUserFind;
      Notification.create = origCreateNotif;
    });
  });
});

