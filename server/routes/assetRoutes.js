import express from "express";
import {
  createAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getEmployeeAssets,
  getAssetHistory,
  getAllAssignments,
} from "../controllers/assetController.js";
import {
  validateCreateAsset,
  validateAssignAsset,
  validateReturnAsset,
} from "../validations/assetValidation.js";
import { verifyToken, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Asset CRUD
router.get(
  "/",
  verifyToken,
  getAllAssets
);

router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateCreateAsset,
  createAsset
);

// All Assignments list
router.get(
  "/assignments/all",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  getAllAssignments
);

// Employee Assets list (accessible by HR/Admin or the employee for 'me')
router.get(
  "/employee/:employeeId",
  verifyToken,
  getEmployeeAssets
);

// Single Asset and History
router.get(
  "/:id",
  verifyToken,
  getAssetById
);

router.get(
  "/:id/history",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  getAssetHistory
);

router.put(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  updateAsset
);

router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  deleteAsset
);

// Asset Assignment & Return
router.post(
  "/assign",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateAssignAsset,
  assignAsset
);

router.post(
  "/return",
  verifyToken,
  authorizeRoles("Admin", "super_admin", "HR", "HR Manager"),
  validateReturnAsset,
  returnAsset
);

export default router;
