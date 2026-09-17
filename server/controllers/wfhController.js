import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import WFHRequest from "../models/WFHRequest.js";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import {
  notifyWFHSubmission,
  notifyWFHDecision,
  notifyWFHWithdrawal,
} from "../services/notificationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, "../uploads/wfh-requests");

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

// Configure Multer storage for WFH attachments
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
    cb(null, `wfh-${safeBaseName}-${uniqueSuffix}${ext}`);
  },
});

export const wfhUploadMulter = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file limit
    files: 5,
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

// Middleware to handle multi-file upload for WFH requests
export const handleWFHUpload = (req, res, next) => {
  const upload = wfhUploadMulter.array("files", 5);
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File is too large. Maximum file size allowed is 10MB.",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded. Maximum 5 files allowed.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "File upload failed.",
      });
    }
    next();
  });
};

const normalizeRole = (role) => {
  if (!role) return "";
  const r = String(role).trim().toLowerCase();
  if (r === "super_admin" || r === "superadmin" || r === "super admin") return "super_admin";
  if (r === "admin") return "admin";
  if (
    r === "hr" ||
    r === "hr manager" ||
    r === "hr_manager" ||
    r === "human resources" ||
    r === "human_resources"
  ) {
    return "hr_manager";
  }
  if (r === "employee") return "employee";
  return r;
};

/**
 * 1. Submit Work From Home Request
 * POST /api/wfh-requests
 */
export const createRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Resolve employee
    const employee = await Employee.findOne({ user_id: userId })
      .populate("user_id", "name email")
      .populate("organizationId", "name");

    if (!employee) {
      // Clean up uploaded files if employee record not found
      if (req.files && req.files.length > 0) {
        req.files.forEach((f) => fs.unlink(f.path, () => {}));
      }
      return res.status(404).json({
        success: false,
        message: "Employee profile not found for your user account.",
      });
    }

    const { reason, start_date, end_date } = req.body;
    const organizationId =
      employee.organizationId?._id || employee.organizationId || req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Employee is not associated with an organization.",
      });
    }

    const attached_files = (req.files || []).map((file) => ({
      file_name: file.originalname,
      stored_filename: file.filename,
      mime_type: file.mimetype,
      file_size: file.size,
    }));

    const wfhRequest = await WFHRequest.create({
      employee_id: employee._id,
      organizationId,
      reason: reason.trim(),
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      attached_files,
      status: "Pending",
      requested_at: new Date(),
    });

    // Populate file_url for each attached file
    wfhRequest.attached_files.forEach((f, idx) => {
      f.file_url = `/api/wfh-requests/${wfhRequest._id}/files/${idx}`;
    });
    await wfhRequest.save();

    // Trigger dual notification: to HR in organization and to Super Admins
    try {
      await notifyWFHSubmission({
        employee,
        organization: employee.organizationId,
        startDate: wfhRequest.start_date,
        endDate: wfhRequest.end_date,
      });
    } catch (notifErr) {
      console.warn("Could not dispatch WFH submission notifications:", notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Work From Home request submitted successfully.",
      data: wfhRequest,
    });
  } catch (error) {
    console.error("createRequest error:", error);
    if (req.files && req.files.length > 0) {
      req.files.forEach((f) => fs.unlink(f.path, () => {}));
    }
    return res.status(500).json({
      success: false,
      message: "Failed to submit Work From Home request",
      error: error.message,
    });
  }
};

/**
 * 2. Get Employee's Own WFH Requests History
 * GET /api/wfh-requests/my-requests
 */
export const getMyRequests = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const employee = await Employee.findOne({ user_id: userId });

    if (!employee) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const requests = await WFHRequest.find({ employee_id: employee._id })
      .populate("decided_by", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("getMyRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your WFH requests",
      error: error.message,
    });
  }
};

/**
 * 3. Get All WFH Requests (HR views own org; Super Admin views all orgs)
 * GET /api/wfh-requests
 */
export const getAllRequests = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user?.role);

    if (userRole === "employee") {
      return res.status(403).json({
        success: false,
        message: "Employees are not authorized to view organization WFH requests. Use /my-requests.",
      });
    }

    const { status, organizationId, employeeId } = req.query;
    const query = {};

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (userRole === "super_admin") {
      // Super Admin: can view across all organizations or filter by a specific org
      if (organizationId && organizationId !== "ALL") {
        query.organizationId = organizationId;
      }
      if (employeeId && employeeId !== "ALL") {
        query.employee_id = employeeId;
      }
    } else {
      // Admin / HR Manager: strictly scoped to their own organization
      if (!req.user?.organizationId) {
        return res.status(400).json({
          success: false,
          message: "User is not linked to an organization.",
        });
      }
      query.organizationId = req.user.organizationId;
      if (employeeId && employeeId !== "ALL") {
        query.employee_id = employeeId;
      }
    }

    const requests = await WFHRequest.find(query)
      .populate({
        path: "employee_id",
        populate: [
          { path: "user_id", select: "name email role" },
          { path: "department_id", select: "departmentName departmentId" },
        ],
        select: "employee_code designation user_id department_id",
      })
      .populate("organizationId", "name code orgCode")
      .populate("decided_by", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("getAllRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch WFH requests",
      error: error.message,
    });
  }
};

/**
 * 4. Decide WFH Request (Super Admin ONLY)
 * PATCH /api/wfh-requests/:id/decide
 * Body: { decision: "Approved" | "Rejected", rejection_reason }
 */
export const decideRequest = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user?.role);

    // Sole Decision-Maker: Only super_admin is authorized
    if (userRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin is authorized to approve or reject Work From Home requests.",
      });
    }

    const { id } = req.params;
    const { decision, rejection_reason } = req.body;

    const wfhRequest = await WFHRequest.findById(id).populate({
      path: "employee_id",
      populate: { path: "user_id", select: "name email" },
    });

    if (!wfhRequest) {
      return res.status(404).json({
        success: false,
        message: "WFH request not found.",
      });
    }

    wfhRequest.status = decision;
    wfhRequest.decided_by = req.user.id || req.user._id;
    wfhRequest.decided_at = new Date();
    wfhRequest.rejection_reason = decision === "Rejected" ? rejection_reason.trim() : null;

    await wfhRequest.save();

    // Trigger notification to employee
    try {
      await notifyWFHDecision({
        employee: wfhRequest.employee_id,
        startDate: wfhRequest.start_date,
        endDate: wfhRequest.end_date,
        decision,
        rejectionReason: wfhRequest.rejection_reason || "",
      });
    } catch (notifErr) {
      console.warn("Could not notify employee on WFH decision:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Work From Home request has been ${decision.toLowerCase()} successfully.`,
      data: wfhRequest,
    });
  } catch (error) {
    console.error("decideRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to decide WFH request",
      error: error.message,
    });
  }
};

/**
 * 5. Download or View Attachment File
 * GET /api/wfh-requests/:id/files/:fileIndex
 */
export const downloadAttachment = async (req, res) => {
  try {
    const { id, fileIndex } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    const wfhRequest = await WFHRequest.findById(id).populate("employee_id");
    if (!wfhRequest) {
      return res.status(404).json({
        success: false,
        message: "WFH request record not found.",
      });
    }

    const idx = parseInt(fileIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= (wfhRequest.attached_files || []).length) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found at this index.",
      });
    }

    const fileMeta = wfhRequest.attached_files[idx];

    // Check RBAC:
    // - Super Admin: global access
    // - HR/Admin: same organization only
    // - Employee: owner only
    const employee = wfhRequest.employee_id;
    const isOwner =
      employee &&
      employee.user_id &&
      String(employee.user_id) === String(userId);

    const isOrgStaff =
      (userRole === "admin" || userRole === "hr_manager") &&
      req.user?.organizationId &&
      String(wfhRequest.organizationId) === String(req.user.organizationId);

    const isSuperAdmin = userRole === "super_admin";

    if (!isSuperAdmin && !isOrgStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You cannot download this file.",
      });
    }

    const filePath = path.resolve(UPLOAD_DIR, fileMeta.stored_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Attachment file not found on server disk.",
      });
    }

    res.setHeader("Content-Type", fileMeta.mime_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileMeta.file_name)}"`
    );

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error("downloadAttachment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download attachment",
      error: error.message,
    });
  }
};

/**
 * 6. Withdraw WFH Request (Employee Self-Service Only)
 * PATCH /api/wfh-requests/:id/withdraw
 * Only allowed by the owner employee and only while status is "Pending"
 */
export const withdrawRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    // Self-service check: HR/admin and super_admin are not permitted to withdraw on employee's behalf
    if (userRole !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the employee who submitted this request can withdraw it.",
      });
    }

    const wfhRequest = await WFHRequest.findById(id)
      .populate({
        path: "employee_id",
        populate: { path: "user_id", select: "name email" },
      })
      .populate("organizationId", "name");

    if (!wfhRequest) {
      return res.status(404).json({
        success: false,
        message: "WFH request not found.",
      });
    }

    // Ownership check: req.user must match request.employee_id's linked user
    const linkedUserId =
      wfhRequest.employee_id?.user_id?._id ||
      wfhRequest.employee_id?.user_id;

    if (!linkedUserId || String(linkedUserId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the employee who submitted this request can withdraw it.",
      });
    }

    // Status check: only pending requests can be withdrawn
    if (wfhRequest.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be withdrawn",
      });
    }

    wfhRequest.status = "Withdrawn";
    wfhRequest.withdrawn_at = new Date();
    await wfhRequest.save();

    // Notify HR/admin and Super Admin of withdrawal
    try {
      await notifyWFHWithdrawal({
        employee: wfhRequest.employee_id,
        organization: wfhRequest.organizationId,
        startDate: wfhRequest.start_date,
        endDate: wfhRequest.end_date,
      });
    } catch (notifErr) {
      console.warn("Could not dispatch WFH withdrawal notifications:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Work From Home request withdrawn successfully.",
      data: wfhRequest,
    });
  } catch (error) {
    console.error("withdrawRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to withdraw WFH request",
      error: error.message,
    });
  }
};

