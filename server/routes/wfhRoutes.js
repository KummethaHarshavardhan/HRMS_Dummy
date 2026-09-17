import express from "express";
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  decideRequest,
  downloadAttachment,
  withdrawRequest,
  handleWFHUpload,
} from "../controllers/wfhController.js";
import {
  validateCreateWFHRequest,
  validateDecideWFHRequest,
} from "../validations/wfhValidation.js";
import {
  verifyToken,
  authorizeRoles,
  authorizeSuperAdmin,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// 1. Submit WFH request (with optional multi-file attachments)
router.post(
  "/",
  verifyToken,
  handleWFHUpload,
  validateCreateWFHRequest,
  createRequest
);

// 2. Get logged-in employee's own requests
router.get("/my-requests", verifyToken, getMyRequests);

// 3. Get all requests (HR/Admin within org, Super Admin global)
router.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager", "super_admin"),
  getAllRequests
);

// 4. Decide WFH request (Sole Decision-Maker: Super Admin ONLY)
router.patch(
  "/:id/decide",
  verifyToken,
  authorizeSuperAdmin,
  validateDecideWFHRequest,
  decideRequest
);

// 5. Download attachment
router.get("/:id/files/:fileIndex", verifyToken, downloadAttachment);

// 6. Withdraw WFH request (Employee self-service)
router.patch("/:id/withdraw", verifyToken, withdrawRequest);

export default router;
