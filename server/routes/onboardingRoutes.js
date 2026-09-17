import express from "express";
import {
  createOnboarding,
  getAllOnboarding,
  getOnboardingById,
  getOnboardingByEmployee,
  getEmployeeLifecycleHistory,
  updateChecklistItem,
  updateOnboardingStatus,
} from "../controllers/onboardingController.js";
import {
  validateCreateOnboarding,
  validateUpdateChecklistItem,
} from "../validations/onboardingValidation.js";
import { verifyToken, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Create onboarding (HR/Admin)
router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateCreateOnboarding,
  createOnboarding
);

// List all onboarding processes (HR/Admin)
router.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  getAllOnboarding
);

// Get employee lifecycle history (all onboardings & offboardings)
router.get(
  "/employee/:employeeId/history",
  verifyToken,
  getEmployeeLifecycleHistory
);

// Get onboarding for a specific employee or 'me'
router.get(
  "/employee/:employeeId",
  verifyToken,
  getOnboardingByEmployee
);

// Get single onboarding by process ID
router.get(
  "/:id",
  verifyToken,
  getOnboardingById
);

// Update checklist item
router.patch(
  "/:id/task/:taskId",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateUpdateChecklistItem,
  updateChecklistItem
);

// Mark onboarding complete or update status
router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  updateOnboardingStatus
);

export default router;
