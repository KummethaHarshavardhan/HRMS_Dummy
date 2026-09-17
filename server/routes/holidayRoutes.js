import express from "express";
import {
  createHoliday,
  getAllHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
  bulkImportHolidays,
} from "../controllers/holidayController.js";
import {
  validateCreateHoliday,
  validateBulkHoliday,
} from "../validations/holidayValidation.js";
import { verifyToken, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Read holidays: All authenticated users
router.get("/", verifyToken, getAllHolidays);
router.get("/:id", verifyToken, getHolidayById);

// Create / Bulk / Update / Delete: HR / Admin / Super Admin only
router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateCreateHoliday,
  createHoliday
);

router.post(
  "/bulk",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateBulkHoliday,
  bulkImportHolidays
);

router.put(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateCreateHoliday,
  updateHoliday
);

router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  deleteHoliday
);

export default router;
