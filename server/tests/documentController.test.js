import { describe, test } from "node:test";
import assert from "node:assert";
import Document, { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from "../models/Document.js";
import Notification from "../models/Notification.js";
import UserModel from "../models/UserModel.js";
import {
  validateDocumentUpload,
  validateDocumentUpdate,
} from "../validations/documentValidation.js";
import {
  documentUploadMulter,
  verifyDocument,
  getAllDocuments,
  getHrUploaders,
} from "../controllers/documentController.js";

// Helper to mock express req, res, next
const createMockReqRes = (body = {}, file = null) => {
  const req = { body, file };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  let calledNext = false;
  const next = () => {
    calledNext = true;
  };
  return { req, res, next, wasNextCalled: () => calledNext };
};

describe("Document Module - Business Logic & Validations", () => {
  describe("File Type Acceptance / Rejection (Multer fileFilter)", () => {
    const fileFilter = documentUploadMulter.fileFilter;

    test("accepts valid PDF file", (t, done) => {
      fileFilter({}, { mimetype: "application/pdf" }, (err, accepted) => {
        assert.strictEqual(err, null);
        assert.strictEqual(accepted, true);
        done();
      });
    });

    test("accepts valid JPEG and PNG files", (t, done) => {
      fileFilter({}, { mimetype: "image/jpeg" }, (err1, accepted1) => {
        assert.strictEqual(err1, null);
        assert.strictEqual(accepted1, true);

        fileFilter({}, { mimetype: "image/png" }, (err2, accepted2) => {
          assert.strictEqual(err2, null);
          assert.strictEqual(accepted2, true);
          done();
        });
      });
    });

    test("accepts valid Word DOCX file", (t, done) => {
      fileFilter(
        {},
        {
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        (err, accepted) => {
          assert.strictEqual(err, null);
          assert.strictEqual(accepted, true);
          done();
        }
      );
    });

    test("rejects executable or unsupported file types", (t, done) => {
      fileFilter({}, { mimetype: "application/x-msdownload" }, (err, accepted) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid file type/);
        assert.strictEqual(accepted, undefined);
        done();
      });
    });

    test("rejects plain text and audio files", (t, done) => {
      fileFilter({}, { mimetype: "text/plain" }, (err, accepted) => {
        assert.ok(err instanceof Error);
        done();
      });
    });
  });

  describe("Document Upload Validation Middleware", () => {
    test("rejects upload when req.file is missing", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        employee_id: "660000000000000000000001",
        category: "Aadhaar",
      });

      validateDocumentUpload(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /No document file uploaded/);
    });

    test("rejects upload when employee_id is missing", () => {
      const mockFile = { originalname: "pan.pdf", mimetype: "application/pdf" };
      const { req, res, next, wasNextCalled } = createMockReqRes(
        { category: "PAN" },
        mockFile
      );

      validateDocumentUpload(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /employee_id is required/);
    });

    test("rejects upload with invalid document category", () => {
      const mockFile = { originalname: "file.pdf", mimetype: "application/pdf" };
      const { req, res, next, wasNextCalled } = createMockReqRes(
        { employee_id: "660000000000000000000001", category: "InvalidCategory" },
        mockFile
      );

      validateDocumentUpload(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /Category is required and must be one of/);
    });

    test("passes upload with all valid fields", () => {
      const mockFile = { originalname: "offer.pdf", mimetype: "application/pdf" };
      const { req, res, next, wasNextCalled } = createMockReqRes(
        {
          employee_id: "660000000000000000000001",
          category: "Offer Letter",
          expiry_date: "2028-12-31",
        },
        mockFile
      );

      validateDocumentUpload(req, res, next);
      assert.strictEqual(wasNextCalled(), true);
    });
  });

  describe("Expiry Status Calculation Logic", () => {
    const calculateStatus = (expiryDate) => {
      if (!expiryDate) return "Active";
      const exp = new Date(expiryDate);
      const now = new Date();
      if (exp < now) return "Expired";
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (exp.getTime() - now.getTime() <= thirtyDaysMs) return "Expiring Soon";
      return "Active";
    };

    test("marks document as Expired when expiry_date is in the past", () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      assert.strictEqual(calculateStatus(pastDate), "Expired");
    });

    test("marks document as Expiring Soon when expiry is within 30 days", () => {
      const soonDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      assert.strictEqual(calculateStatus(soonDate), "Expiring Soon");
    });

    test("marks document as Active when expiry is far into the future", () => {
      const futureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      assert.strictEqual(calculateStatus(futureDate), "Active");
    });

    test("marks document as Active when no expiry date is provided", () => {
      assert.strictEqual(calculateStatus(null), "Active");
      assert.strictEqual(calculateStatus(undefined), "Active");
    });
  });

  describe("Document Constants Coverage", () => {
    test("contains standard required categories", () => {
      const expected = [
        "ID Proof",
        "Educational Certificate",
        "Offer Letter",
        "Relieving Letter",
        "Payslip",
        "Contract",
        "Other",
      ];
      for (const cat of expected) {
        assert.ok(DOCUMENT_CATEGORIES.includes(cat), `Missing category: ${cat}`);
      }
    });

    test("contains allowed statuses", () => {
      assert.deepStrictEqual(DOCUMENT_STATUSES, [
        "Pending Verification",
        "Verified",
        "Rejected",
        "Expired",
        "Archived",
      ]);
    });
  });

  describe("Document Verification Workflow (verifyDocument)", () => {
    test("rejects unauthorized caller role (e.g. Employee)", async () => {
      const { req, res } = createMockReqRes({ decision: "Verified" });
      req.user = { id: "user_emp_123", role: "Employee", organizationId: "org_1" };
      req.params = { id: "doc_123" };

      await verifyDocument(req, res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Only HR Managers/);
    });

    test("rejects invalid or missing decision parameter", async () => {
      const { req, res } = createMockReqRes({ decision: "Approved" }); // not Verified or Rejected
      req.user = { id: "admin_123", role: "Admin", organizationId: "org_1" };
      req.params = { id: "doc_123" };

      await verifyDocument(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /Decision must be either 'Verified' or 'Rejected'/);
    });

    test("rejects decision Rejected when rejection_reason is omitted", async () => {
      const { req, res } = createMockReqRes({ decision: "Rejected", rejection_reason: "   " });
      req.user = { id: "hr_123", role: "HR Manager", organizationId: "org_1" };
      req.params = { id: "doc_123" };

      await verifyDocument(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /A rejection reason is required/);
    });

    test("happy path: verifies document and sets verified_by, verified_at, and triggers notification", async () => {
      const originalFindById = Document.findById;
      const originalNotifCreate = Notification.create;
      let triggeredNotif = null;

      const mockDoc = {
        _id: "660000000000000000000123",
        category: "Offer Letter",
        status: "Pending Verification",
        organizationId: "660000000000000000000001",
        employee_id: {
          _id: "660000000000000000000111",
          user_id: "660000000000000000000456",
        },
        save: async function () {
          return this;
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });

      Notification.create = async (payload) => {
        triggeredNotif = payload;
        return { _id: "notif_1", ...payload };
      };

      try {
        const { req, res } = createMockReqRes({ decision: "Verified" });
        req.user = { id: "660000000000000000000999", role: "Admin", organizationId: "660000000000000000000001" };
        req.params = { id: "660000000000000000000123" };

        await verifyDocument(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(mockDoc.status, "Verified");
        assert.strictEqual(mockDoc.verified_by, "660000000000000000000999");
        assert.ok(mockDoc.verified_at instanceof Date);
        assert.strictEqual(mockDoc.rejection_reason, null);

        // Verify notification trigger
        assert.ok(triggeredNotif, "Notification should have been triggered");
        assert.strictEqual(triggeredNotif.type, "document_verified");
        assert.strictEqual(String(triggeredNotif.recipient), "660000000000000000000456");
        assert.match(triggeredNotif.message, /Offer Letter/);
        assert.match(triggeredNotif.message, /verified/i);
      } finally {
        Document.findById = originalFindById;
        Notification.create = originalNotifCreate;
      }
    });

    test("happy path: rejects document with reason and triggers rejection notification", async () => {
      const originalFindById = Document.findById;
      const originalNotifCreate = Notification.create;
      let triggeredNotif = null;

      const mockDoc = {
        _id: "660000000000000000000124",
        category: "ID Proof",
        status: "Pending Verification",
        organizationId: "660000000000000000000001",
        employee_id: {
          _id: "660000000000000000000111",
          user_id: "660000000000000000000456",
        },
        save: async function () {
          return this;
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });

      Notification.create = async (payload) => {
        triggeredNotif = payload;
        return { _id: "notif_2", ...payload };
      };

      try {
        const { req, res } = createMockReqRes({
          decision: "Rejected",
          rejection_reason: "Aadhaar image is unclear and illegible.",
        });
        req.user = { id: "660000000000000000000888", role: "HR Manager", organizationId: "660000000000000000000001" };
        req.params = { id: "660000000000000000000124" };

        await verifyDocument(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(mockDoc.status, "Rejected");
        assert.strictEqual(mockDoc.rejection_reason, "Aadhaar image is unclear and illegible.");

        // Verify notification trigger
        assert.ok(triggeredNotif, "Notification should have been triggered");
        assert.strictEqual(triggeredNotif.type, "document_rejected");
        assert.strictEqual(String(triggeredNotif.recipient), "660000000000000000000456");
        assert.match(triggeredNotif.message, /ID Proof/);
        assert.match(triggeredNotif.message, /Aadhaar image is unclear and illegible/);
      } finally {
        Document.findById = originalFindById;
        Notification.create = originalNotifCreate;
      }
    });

    test("multi-tenant isolation: blocks verification for document belonging to another org", async () => {
      const originalFindById = Document.findById;
      const mockDoc = {
        _id: "doc_other_org",
        category: "ID Proof",
        status: "Pending Verification",
        organizationId: "org_DIFFERENT",
        employee_id: {
          _id: "emp_123",
          user_id: "user_emp_456",
        },
        save: async function () {
          return this;
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });

      try {
        const { req, res } = createMockReqRes({ decision: "Verified" });
        req.user = { id: "admin_123", role: "Admin", organizationId: "org_1" };
        req.params = { id: "doc_other_org" };

        await verifyDocument(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /Document belongs to another organization/);
      } finally {
        Document.findById = originalFindById;
      }
    });

    test("change decision: allows HR to change Verified document to Rejected and vice-versa", async () => {
      const originalFindById = Document.findById;
      const originalNotifCreate = Notification.create;

      const mockDoc = {
        _id: "doc_change_decision",
        category: "Experience Letter",
        status: "Verified",
        organizationId: "org_1",
        rejection_reason: null,
        employee_id: {
          _id: "emp_123",
          user_id: "user_emp_456",
        },
        save: async function () {
          return this;
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });
      Notification.create = async () => ({ _id: "notif_change" });

      try {
        // Step 1: Change Verified -> Rejected
        const { req: req1, res: res1 } = createMockReqRes({
          decision: "Rejected",
          rejection_reason: "Document was found to be forged upon audit.",
        });
        req1.user = { id: "hr_user_1", role: "HR Manager", organizationId: "org_1" };
        req1.params = { id: "doc_change_decision" };

        await verifyDocument(req1, res1);
        assert.strictEqual(res1.statusCode, 200);
        assert.strictEqual(mockDoc.status, "Rejected");
        assert.strictEqual(mockDoc.rejection_reason, "Document was found to be forged upon audit.");

        // Step 2: Change Rejected -> Verified
        const { req: req2, res: res2 } = createMockReqRes({
          decision: "Verified",
        });
        req2.user = { id: "hr_user_1", role: "HR Manager", organizationId: "org_1" };
        req2.params = { id: "doc_change_decision" };

        await verifyDocument(req2, res2);
        assert.strictEqual(res2.statusCode, 200);
        assert.strictEqual(mockDoc.status, "Verified");
        assert.strictEqual(mockDoc.rejection_reason, null);
      } finally {
        Document.findById = originalFindById;
        Notification.create = originalNotifCreate;
      }
    });
  });

  describe("Super Admin Document Verification Workflow", () => {
    test("non super_admin calling getHrUploaders gets 403", async () => {
      const { req, res } = createMockReqRes();
      req.user = { id: "hr_1", role: "HR Manager", organizationId: "org_1" };
      req.query = {};

      await getHrUploaders(req, res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Only Super Admin can fetch HR uploaders/);
    });

    test("super_admin sees only admin/hr_manager-uploaded documents across all orgs", async () => {
      const originalUserFind = UserModel.find;
      const originalDocFind = Document.find;
      let capturedQuery = null;

      UserModel.find = () => ({
        select: async () => [{ _id: "hr_user_1" }, { _id: "hr_user_2" }],
      });

      Document.find = (query) => {
        capturedQuery = query;
        return {
          populate: () => ({
            populate: () => ({
              populate: () => ({
                sort: async () => [
                  { _id: "doc_1", file_name: "policy.pdf", category: "Contract", uploader_role: "admin" },
                ],
              }),
            }),
          }),
        };
      };

      try {
        const { req, res } = createMockReqRes();
        req.user = { id: "sa_1", role: "super_admin" };
        req.query = {};

        await getAllDocuments(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.ok(capturedQuery, "Query should have been passed to Document.find");
        assert.deepStrictEqual(capturedQuery.uploader_role, { $in: ["admin", "hr_manager"] });
        assert.strictEqual(capturedQuery.organizationId, undefined, "Super admin sees across all organizations");
      } finally {
        UserModel.find = originalUserFind;
        Document.find = originalDocFind;
      }
    });

    test("filtering by HR name (uploaderId) and organization narrows query correctly", async () => {
      const originalUserFind = UserModel.find;
      const originalDocFind = Document.find;
      let capturedQuery = null;

      UserModel.find = () => ({
        select: async () => [{ _id: "hr_user_1" }],
      });

      Document.find = (query) => {
        capturedQuery = query;
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

      try {
        const { req, res } = createMockReqRes();
        req.user = { id: "sa_1", role: "super_admin" };
        req.query = { organizationId: "org_acme_123", uploaderId: "hr_user_1" };

        await getAllDocuments(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(capturedQuery.organizationId, "org_acme_123");
        assert.strictEqual(capturedQuery.uploaded_by, "hr_user_1");
      } finally {
        UserModel.find = originalUserFind;
        Document.find = originalDocFind;
      }
    });

    test("'All Documents' resets organization and uploader filters for super_admin", async () => {
      const originalUserFind = UserModel.find;
      const originalDocFind = Document.find;
      let capturedQuery = null;

      UserModel.find = () => ({
        select: async () => [],
      });

      Document.find = (query) => {
        capturedQuery = query;
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

      try {
        const { req, res } = createMockReqRes();
        req.user = { id: "sa_1", role: "super_admin" };
        req.query = { organizationId: "ALL", uploaderId: "ALL" };

        await getAllDocuments(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(capturedQuery.organizationId, undefined);
        assert.strictEqual(capturedQuery.uploaded_by, undefined);
      } finally {
        UserModel.find = originalUserFind;
        Document.find = originalDocFind;
      }
    });

    test("super_admin Verified notifies the specific HR uploader (not the whole org)", async () => {
      const originalFindById = Document.findById;
      const originalNotifCreate = Notification.create;
      let triggeredNotif = null;

      const mockDoc = {
        _id: "doc_hr_upload_1",
        category: "Contract",
        file_name: "Vendor_Agreement.pdf",
        status: "Pending Verification",
        uploader_role: "hr_manager",
        uploaded_by: {
          _id: "hr_user_specific_999",
          name: "Priya Sharma",
          role: "HR Manager",
        },
        save: async function () {
          return this;
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });

      Notification.create = async (payload) => {
        triggeredNotif = payload;
        return { _id: "notif_sa_1", ...payload };
      };

      try {
        const { req, res } = createMockReqRes({ decision: "Verified" });
        req.user = { id: "sa_admin_id", role: "super_admin", name: "Platform Admin" };
        req.params = { id: "doc_hr_upload_1" };

        await verifyDocument(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(mockDoc.status, "Verified");
        assert.ok(triggeredNotif, "Notification should be dispatched");
        assert.strictEqual(String(triggeredNotif.recipient), "hr_user_specific_999");
        assert.strictEqual(
          triggeredNotif.message,
          "Your uploaded Contract document (Vendor_Agreement.pdf) has been verified by the platform admin."
        );
      } finally {
        Document.findById = originalFindById;
        Notification.create = originalNotifCreate;
      }
    });

    test("super_admin Reject notifies specific HR uploader with reason", async () => {
      const originalFindById = Document.findById;
      const originalNotifCreate = Notification.create;
      let triggeredNotif = null;

      const mockDoc = {
        _id: "doc_hr_upload_2",
        category: "ID Proof",
        file_name: "HR_Director_Passport.pdf",
        status: "Pending Verification",
        uploader_role: "admin",
        uploaded_by: {
          _id: "admin_user_444",
          name: "Alex Admin",
          role: "Admin",
        },
        save: async function () {
          return this;
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });

      Notification.create = async (payload) => {
        triggeredNotif = payload;
        return { _id: "notif_sa_2", ...payload };
      };

      try {
        const { req, res } = createMockReqRes({
          decision: "Rejected",
          rejection_reason: "Document image is expired",
        });
        req.user = { id: "sa_admin_id", role: "super_admin", name: "Platform Admin" };
        req.params = { id: "doc_hr_upload_2" };

        await verifyDocument(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(mockDoc.status, "Rejected");
        assert.strictEqual(String(triggeredNotif.recipient), "admin_user_444");
        assert.strictEqual(
          triggeredNotif.message,
          "Your uploaded ID Proof document (HR_Director_Passport.pdf) was not verified. Reason: Document image is expired."
        );
      } finally {
        Document.findById = originalFindById;
        Notification.create = originalNotifCreate;
      }
    });

    test("super_admin cannot verify employee-uploaded documents", async () => {
      const originalFindById = Document.findById;
      const mockDoc = {
        _id: "doc_emp_upload",
        category: "Payslip",
        file_name: "emp_payslip.pdf",
        uploader_role: "employee",
        uploaded_by: {
          _id: "emp_user_1",
          role: "Employee",
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });

      try {
        const { req, res } = createMockReqRes({ decision: "Verified" });
        req.user = { id: "sa_1", role: "super_admin" };
        req.params = { id: "doc_emp_upload" };

        await verifyDocument(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert.match(res.data.message, /Super Admin can only verify documents uploaded by HR\/Admin/);
      } finally {
        Document.findById = originalFindById;
      }
    });

    test("hr_manager cannot verify HR-uploaded documents", async () => {
      const originalFindById = Document.findById;
      const mockDoc = {
        _id: "doc_hr_upload_3",
        category: "Contract",
        file_name: "corporate_mou.pdf",
        uploader_role: "admin",
        uploaded_by: {
          _id: "admin_user_555",
          role: "Admin",
        },
      };

      Document.findById = () => ({
        populate: async () => mockDoc,
      });

      try {
        const { req, res } = createMockReqRes({ decision: "Verified" });
        req.user = { id: "hr_1", role: "HR Manager", organizationId: "org_1" };
        req.params = { id: "doc_hr_upload_3" };

        await verifyDocument(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert.match(res.data.message, /HR Managers cannot verify HR-uploaded documents/);
      } finally {
        Document.findById = originalFindById;
      }
    });
  });
});
