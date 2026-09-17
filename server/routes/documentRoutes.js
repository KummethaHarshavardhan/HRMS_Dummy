import express from "express";
import {
  handleDocumentUpload,
  uploadDocument,
  getDocumentsByEmployee,
  downloadDocument,
  updateDocument,
  deleteDocument,
  verifyDocument,
  getAllDocuments,
  getHrUploaders,
} from "../controllers/documentController.js";
import {
  validateDocumentUpload,
  validateDocumentUpdate,
} from "../validations/documentValidation.js";
import { verifyToken, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// List all documents (HR/Admin for their organization; Super Admin for HR-uploaded documents)
router.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "HR Manager", "HR", "super_admin"),
  getAllDocuments
);

// Get HR uploaders across organizations (Super Admin only)
router.get(
  "/hr-uploaders",
  verifyToken,
  authorizeRoles("super_admin"),
  getHrUploaders
);

// Upload document (authenticated users: HR/Admin or Employee for their own)
router.post(
  "/upload",
  verifyToken,
  handleDocumentUpload,
  validateDocumentUpload,
  uploadDocument
);

// List documents for an employee
router.get(
  "/employee/:employeeId",
  verifyToken,
  getDocumentsByEmployee
);

// Secure download / stream
router.get(
  "/download/:id",
  verifyToken,
  downloadDocument
);

// Update document metadata
router.patch(
  "/:id",
  verifyToken,
  validateDocumentUpdate,
  updateDocument
);

// Delete / Archive document
router.delete(
  "/:id",
  verifyToken,
  deleteDocument
);

// Verify or Reject document (HR/Admin or Super Admin)
router.patch(
  "/:id/verify",
  verifyToken,
  authorizeRoles("Admin", "HR Manager", "HR", "super_admin"),
  verifyDocument
);

export default router;
