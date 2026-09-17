import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import Document from "../models/Document.js";
import Employee from "../models/Employee.js";
import UserModel from "../models/UserModel.js";
import { normalizeRole } from "../middlewares/authMiddleware.js";
import {
  createNotification,
  sendDocumentVerificationNotification,
  notifyHrOnDocumentUpload,
} from "../services/notificationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, "../uploads/documents");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types: PDF, JPG, PNG, DOCX, DOC
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    cb(null, `doc-${safeBaseName}-${uniqueSuffix}${ext}`);
  },
});

export const documentUploadMulter = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, JPG, PNG, and DOCX files are allowed."
        )
      );
    }
  },
});

// Multer error handling wrapper middleware
export const handleDocumentUpload = (req, res, next) => {
  const upload = documentUploadMulter.single("file");
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File is too large. Maximum allowed size is 10MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to upload file.",
      });
    }
    next();
  });
};

/**
 * 1. Upload a Document
 * POST /api/documents/upload
 */
export const uploadDocument = async (req, res) => {
  try {
    const { employee_id, category, expiry_date, notes } = req.body;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    // Verify employee exists
    const employee = await Employee.findById(employee_id).populate("user_id");
    if (!employee) {
      // Clean up uploaded file if employee doesn't exist
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(404).json({
        success: false,
        message: "Target employee record not found.",
      });
    }

    // RBAC: Employee can only upload to their own profile
    const isOwner =
      employee.user_id &&
      (String(employee.user_id._id || employee.user_id) === String(userId));
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(403).json({
        success: false,
        message: "You can only upload documents to your own employee profile.",
      });
    }

    const file = req.file;
    const initialStatus =
      expiry_date && new Date(expiry_date) < new Date()
        ? "Expired"
        : "Pending Verification";

    const document = await Document.create({
      employee_id,
      category,
      file_name: file.originalname,
      stored_filename: file.filename,
      file_url: `/api/documents/download/temp`, // will be set below
      mime_type: file.mimetype,
      file_size: file.size,
      uploaded_by: userId,
      uploader_role: userRole || "employee",
      uploaded_at: new Date(),
      expiry_date: expiry_date ? new Date(expiry_date) : null,
      status: initialStatus,
      organizationId: req.user?.organizationId || employee.organizationId || null,
    });

    document.file_url = `/api/documents/download/${document._id}`;
    await document.save();

    // If uploaded by employee, notify all HR/Admins in organization
    if (isOwner) {
      await notifyHrOnDocumentUpload({ document, employee });
    } else if (employee.user_id) {
      // Notify employee if document was uploaded by someone else (e.g. HR/Admin)
      const recipientId = employee.user_id._id || employee.user_id;
      await createNotification({
        recipient: recipientId,
        type: "document_uploaded",
        message: `A new document (${category}: ${file.originalname}) was uploaded to your profile.`,
        link: `/profile`,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully.",
      document,
    });
  } catch (error) {
    console.error("uploadDocument error:", error);
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error: error.message,
    });
  }
};

/**
 * 2. Get Documents for an Employee
 * GET /api/documents/employee/:employeeId
 */
export const getDocumentsByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { category, status } = req.query;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // RBAC: Check access
    const isOwner =
      employee.user_id && String(employee.user_id) === String(userId);
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this employee's documents.",
      });
    }

    // Multi-tenant check: staff can only access employees within their own organization
    if (isStaff && userRole !== "super_admin" && req.user?.organizationId) {
      if (employee.organizationId && String(employee.organizationId) !== String(req.user.organizationId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Employee belongs to another organization.",
        });
      }
    }

    const query = { employee_id: employeeId };
    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }
    if (category) query.category = category;
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: "Archived" }; // default: exclude archived
    }

    const docs = await Document.find(query)
      .populate("uploaded_by", "name email role")
      .populate("verified_by", "name email role")
      .sort({ createdAt: -1 });

    // Dynamically check and update any expired documents
    const now = new Date();
    for (const doc of docs) {
      if (doc.status !== "Expired" && doc.status !== "Archived" && doc.expiry_date && doc.expiry_date < now) {
        doc.status = "Expired";
        await Document.updateOne({ _id: doc._id }, { status: "Expired" });
      }
    }

    return res.status(200).json({
      success: true,
      count: docs.length,
      documents: docs,
    });
  } catch (error) {
    console.error("getDocumentsByEmployee error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee documents",
      error: error.message,
    });
  }
};

/**
 * 2b. Get All Documents
 * GET /api/documents
 * - Super Admin: only sees documents uploaded by HR/Admin across all orgs (never employee-uploaded)
 * - HR/Admin: only sees documents uploaded by employees within their own org (never HR-uploaded)
 */
export const getAllDocuments = async (req, res) => {
  try {
    const { employeeId, departmentId, status, category, organizationId, uploaderId } = req.query;
    const userRole = normalizeRole(req.user?.role);

    if (userRole !== "admin" && userRole !== "hr_manager" && userRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only HR Managers, Admins, and Super Admin can view documents.",
      });
    }

    const query = {};

    if (userRole === "super_admin") {
      // Super admin ONLY sees documents uploaded by hr_manager/admin users across all orgs
      query.uploader_role = { $in: ["admin", "hr_manager"] };

      if (organizationId && organizationId !== "ALL") {
        query.organizationId = organizationId;
      }

      if (uploaderId && uploaderId !== "ALL") {
        query.uploaded_by = uploaderId;
      }
    } else {
      // HR/Admin: scoped strictly to their own organization
      if (req.user?.organizationId) {
        query.organizationId = req.user.organizationId;
      }

      // HR/Admin ONLY sees employee-uploaded documents (never HR-uploaded documents)
      query.uploader_role = { $nin: ["admin", "hr_manager", "super_admin"] };

      if (employeeId && employeeId !== "ALL") {
        query.employee_id = employeeId;
      }

      if (departmentId && departmentId !== "ALL" && (!employeeId || employeeId === "ALL")) {
        const empQuery = { department_id: departmentId };
        if (req.user?.organizationId) {
          empQuery.organizationId = req.user.organizationId;
        }
        const departmentEmployees = await Employee.find(empQuery).select("_id");
        const empIds = departmentEmployees.map((e) => e._id);
        query.employee_id = { $in: empIds };
      }
    }

    if (category && category !== "ALL") {
      query.category = category;
    }

    if (status && status !== "ALL") {
      query.status = status;
    } else {
      query.status = { $ne: "Archived" };
    }

    const docQuery = Document.find(query);
    const populated = typeof docQuery.populate === "function"
      ? docQuery.populate([
          {
            path: "employee_id",
            populate: [
              { path: "user_id", select: "name email role organizationId" },
              { path: "department_id", select: "departmentName" },
            ],
          },
          {
            path: "uploaded_by",
            select: "name email role organizationId",
            populate: { path: "organizationId", select: "name orgCode code" },
          },
          { path: "organizationId", select: "name orgCode code" },
          { path: "verified_by", select: "name email role" },
        ])
      : docQuery;

    const sorted = typeof populated.sort === "function"
      ? populated.sort({ createdAt: -1 })
      : populated;

    const docs = await sorted;

    return res.status(200).json({
      success: true,
      count: (docs || []).length,
      documents: docs || [],
    });
  } catch (error) {
    console.error("getAllDocuments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
      error: error.message,
    });
  }
};

/**
 * 2c. Get HR Uploaders across organizations (Super Admin only)
 * GET /api/documents/hr-uploaders
 */
export const getHrUploaders = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (userRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin can fetch HR uploaders.",
      });
    }

    const { organizationId } = req.query;

    const docQuery = {
      uploader_role: { $in: ["admin", "hr_manager"] },
      status: { $ne: "Archived" },
    };

    if (organizationId && organizationId !== "ALL") {
      docQuery.organizationId = organizationId;
    }

    const docFind = Document.find(docQuery);
    const populated = typeof docFind.populate === "function"
      ? docFind.populate({
          path: "uploaded_by",
          select: "name email role organizationId",
          populate: { path: "organizationId", select: "name orgCode code" },
        })
      : docFind;

    const docs = await populated;
    const uploaderMap = new Map();
    for (const d of (docs || [])) {
      const uploader = d.uploaded_by;
      if (uploader && uploader._id && !uploaderMap.has(String(uploader._id))) {
        uploaderMap.set(String(uploader._id), uploader);
      }
    }

    const uploaders = Array.from(uploaderMap.values());

    return res.status(200).json({
      success: true,
      count: uploaders.length,
      hrUploaders: uploaders,
    });
  } catch (error) {
    console.error("getHrUploaders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch HR uploaders",
      error: error.message,
    });
  }
};

/**
 * 3. Download / Stream Document
 * GET /api/documents/download/:id
 */
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    const document = await Document.findById(id).populate("employee_id");
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document record not found.",
      });
    }

    // Check RBAC
    const employee = document.employee_id;
    const isOwner =
      employee &&
      employee.user_id &&
      String(employee.user_id) === String(userId);
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You cannot download this document.",
      });
    }

    const filePath = path.resolve(UPLOAD_DIR, document.stored_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Document file not found on disk.",
      });
    }

    // Set correct MIME and headers for streaming download
    res.setHeader("Content-Type", document.mime_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(document.file_name)}"`
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("downloadDocument error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download document",
      error: error.message,
    });
  }
};

/**
 * 4. Update Document
 * PATCH /api/documents/:id
 */
export const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, expiry_date, status } = req.body;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    const doc = await Document.findById(id).populate("employee_id");
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const isOwner =
      doc.employee_id?.user_id &&
      String(doc.employee_id.user_id) === String(userId);
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    if (category) doc.category = category;
    if (expiry_date !== undefined) {
      doc.expiry_date = expiry_date ? new Date(expiry_date) : null;
      if (doc.expiry_date && doc.expiry_date < new Date() && doc.status === "Active") {
        doc.status = "Expired";
      } else if (doc.expiry_date && doc.expiry_date >= new Date() && doc.status === "Expired") {
        doc.status = "Active";
      }
    }
    if (status) doc.status = status;

    await doc.save();

    return res.status(200).json({
      success: true,
      message: "Document updated successfully.",
      document: doc,
    });
  } catch (error) {
    console.error("updateDocument error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update document",
      error: error.message,
    });
  }
};

/**
 * 5. Delete (Archive) Document
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    const doc = await Document.findById(id).populate("employee_id");
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const isOwner =
      doc.employee_id?.user_id &&
      String(doc.employee_id.user_id) === String(userId);
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    // Soft delete by archiving
    doc.status = "Archived";
    await doc.save();

    return res.status(200).json({
      success: true,
      message: "Document archived successfully.",
    });
  } catch (error) {
    console.error("deleteDocument error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: error.message,
    });
  }
};

/**
 * 6. Verify or Reject Document
 * PATCH /api/documents/:id/verify
 * Body: { decision: "Verified" | "Rejected", rejection_reason }
 */
export const verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, rejection_reason } = req.body;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    // Only admin, hr_manager, and super_admin can verify or reject documents
    if (userRole !== "admin" && userRole !== "hr_manager" && userRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only HR Managers, Admins, and Super Admin can verify or reject documents.",
      });
    }

    if (!decision || !["Verified", "Rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be either 'Verified' or 'Rejected'.",
      });
    }

    if (decision === "Rejected" && (!rejection_reason || !rejection_reason.trim())) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required when rejecting a document.",
      });
    }

    const docQuery = Document.findById(id);
    const doc = await (typeof docQuery.populate === "function"
      ? docQuery.populate([{ path: "employee_id" }, { path: "uploaded_by" }])
      : docQuery);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    // Check if the document was uploaded by HR/Admin
    const uploaderRole = normalizeRole(doc.uploader_role || doc.uploaded_by?.role);
    const isHrUploaded = uploaderRole === "admin" || uploaderRole === "hr_manager";

    if (userRole === "super_admin") {
      // Super admin can ONLY verify documents uploaded by HR/Admin users
      if (!isHrUploaded) {
        return res.status(403).json({
          success: false,
          message: "Super Admin can only verify documents uploaded by HR/Admin users.",
        });
      }
    } else {
      // HR/Admin can ONLY verify employee-uploaded documents (not HR-uploaded)
      if (isHrUploaded) {
        return res.status(403).json({
          success: false,
          message: "HR Managers cannot verify HR-uploaded documents. Only platform admin can verify them.",
        });
      }

      // Organization scoping: must belong to the same organization
      if (req.user?.organizationId) {
        if (doc.organizationId && String(doc.organizationId) !== String(req.user.organizationId)) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Document belongs to another organization.",
          });
        }
      }
    }

    // Update document
    doc.status = decision;
    doc.verified_by = userId;
    doc.verified_at = new Date();
    doc.rejection_reason = decision === "Rejected" ? rejection_reason.trim() : null;

    await doc.save();

    // Trigger notifications
    if (userRole === "super_admin") {
      // Notifies that specific HR/admin uploader (not the whole org):
      const recipientId = doc.uploaded_by?._id || doc.uploaded_by;
      if (recipientId) {
        await sendDocumentVerificationNotification({
          recipient: recipientId,
          category: doc.category,
          decision,
          rejectionReason: doc.rejection_reason || "",
          link: "/profile",
          isPlatformAdmin: true,
          fileName: doc.file_name,
        });
      }
    } else {
      // HR notifies the employee
      const employee = doc.employee_id;
      const recipientId = employee?.user_id?._id || employee?.user_id || doc.uploaded_by;
      if (recipientId) {
        await sendDocumentVerificationNotification({
          recipient: recipientId,
          category: doc.category,
          decision,
          rejectionReason: doc.rejection_reason || "",
          link: "/profile",
          isPlatformAdmin: false,
          fileName: doc.file_name,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Document has been ${decision.toLowerCase()} successfully.`,
      document: doc,
    });
  } catch (error) {
    console.error("verifyDocument error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify document.",
      error: error.message,
    });
  }
};

