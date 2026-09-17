import express from "express";
import {
  getAllShifts,
  createShift,
  updateShift,
  deleteShift,
  getMyShift,
  getAllShiftGroups,
  createShiftGroup,
  updateShiftGroup,
  assignShiftToGroup,
  addEmployeesToGroup,
  removeEmployeeFromGroup,
  deleteShiftGroup,
} from "../controllers/shiftController.js";
import {
  validateCreateShift,
  validateUpdateShift,
  validateCreateShiftGroup,
  validateAssignShift,
} from "../validations/shiftValidation.js";
import { verifyToken, authorizeRoles } from "../middlewares/authMiddleware.js";

// ==========================================
// 1. Shift Definitions Router (/api/shifts)
// ==========================================
const shiftRouter = express.Router();

// Employee self-service endpoint (accessible by employee, admin, hr)
shiftRouter.get(
  "/my-shift",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager", "Employee", "employee"),
  getMyShift
);

shiftRouter.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  getAllShifts
);

shiftRouter.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  validateCreateShift,
  createShift
);

shiftRouter.put(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  validateUpdateShift,
  updateShift
);

shiftRouter.delete(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  deleteShift
);

// ==========================================
// 2. Shift Groups Router (/api/shift-groups)
// ==========================================
const shiftGroupRouter = express.Router();

shiftGroupRouter.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  getAllShiftGroups
);

shiftGroupRouter.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  validateCreateShiftGroup,
  createShiftGroup
);

shiftGroupRouter.put(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  updateShiftGroup
);

shiftGroupRouter.post(
  "/:id/assign-shift",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  validateAssignShift,
  assignShiftToGroup
);

shiftGroupRouter.post(
  "/:id/add-employees",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  addEmployeesToGroup
);

shiftGroupRouter.delete(
  "/:id/employees/:employeeId",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  removeEmployeeFromGroup
);

shiftGroupRouter.delete(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "HR", "HR Manager"),
  deleteShiftGroup
);

export { shiftRouter, shiftGroupRouter };
export default shiftRouter;
