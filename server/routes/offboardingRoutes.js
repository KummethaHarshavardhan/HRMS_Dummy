import express from "express";
import {
  createOffboarding,
  getAllOffboarding,
  getOffboardingById,
  getOffboardingByEmployee,
  updateChecklistItem,
  updateClearanceSignOff,
  completeOffboarding,
  generateExperienceLetter,
  getExitPackageDetails,
  settlePF,
  downloadAttendanceSummary,
  downloadLeaveSummary,
  downloadNoDuesCertificate,
  downloadRelievingLetter,
} from "../controllers/offboardingController.js";
import {
  validateCreateOffboarding,
  validateClearanceSignOff,
} from "../validations/offboardingValidation.js";
import { verifyToken, authorizeRoles, authorizeSuperAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Initiate offboarding (HR/Admin)
router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateCreateOffboarding,
  createOffboarding
);

// List all offboarding processes (HR/Admin)
router.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  getAllOffboarding
);

// Get offboarding for employee or 'me'
router.get(
  "/employee/:employeeId",
  verifyToken,
  getOffboardingByEmployee
);

// Get single offboarding by process ID
router.get(
  "/:id",
  verifyToken,
  getOffboardingById
);

// Update checklist item
router.patch(
  "/:id/task/:taskId",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  updateChecklistItem
);

// Department clearance sign-off (HR, IT, Finance, Manager)
router.patch(
  "/:id/clearance",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateClearanceSignOff,
  updateClearanceSignOff
);

// Mark offboarding complete (sets employee employment_status to Inactive)
router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  completeOffboarding
);

// Generate / download experience letter (HR/Admin and Employee self-service)
router.get(
  "/:id/experience-letter",
  verifyToken,
  authorizeRoles("admin", "hr_manager", "employee", "super_admin"),
  generateExperienceLetter
);

// Exit Package metadata (Month-wise payslips, asset return status, clearance status, PF settlement, other docs)
router.get(
  "/:id/exit-package",
  verifyToken,
  authorizeRoles("admin", "hr_manager", "employee", "super_admin"),
  getExitPackageDetails
);

// Settle Provident Fund (Super Admin only)
router.post(
  "/:id/settle-pf",
  verifyToken,
  authorizeSuperAdmin,
  settlePF
);

// Attendance Summary PDF covering full tenure
router.get(
  "/:id/attendance-summary",
  verifyToken,
  authorizeRoles("admin", "hr_manager", "employee", "super_admin"),
  downloadAttendanceSummary
);

// Leave Summary PDF covering full tenure
router.get(
  "/:id/leave-summary",
  verifyToken,
  authorizeRoles("admin", "hr_manager", "employee", "super_admin"),
  downloadLeaveSummary
);

// No-Dues Certificate PDF (only if 0 active assets && all clearances signed)
router.get(
  "/:id/no-dues-certificate",
  verifyToken,
  authorizeRoles("admin", "hr_manager", "employee", "super_admin"),
  downloadNoDuesCertificate
);

// Relieving Letter PDF
router.get(
  "/:id/relieving-letter",
  verifyToken,
  authorizeRoles("admin", "hr_manager", "employee", "super_admin"),
  downloadRelievingLetter
);

export default router;


