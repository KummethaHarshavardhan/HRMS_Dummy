import mongoose from "mongoose";
import Shift from "../models/Shift.js";
import ShiftGroup from "../models/ShiftGroup.js";
import Employee from "../models/Employee.js";
import { notifyShiftAssignment } from "../services/notificationService.js";

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

const resolveUserOrg = (req) => {
  const role = normalizeRole(req.user?.role);
  if (role === "super_admin") {
    return {
      error: {
        status: 403,
        message: "Super Admin is not authorized to manage organization shifts.",
      },
    };
  }

  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return {
      error: {
        status: 400,
        message: "User is not linked to any organization.",
      },
    };
  }

  return { organizationId, role };
};

// =========================================================================
// SHIFT DEFINITIONS (CRUD)
// =========================================================================

/**
 * 1. Get All Shifts for Current Organization
 * GET /api/shifts
 */
export const getAllShifts = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;

    let shifts = await Shift.find({ organizationId }).sort({ createdAt: -1 });

    // If no shifts exist yet for this organization, auto-seed standard default shifts
    if ((!shifts || shifts.length === 0) && mongoose.connection?.readyState === 1) {
      const defaultShifts = [
        {
          name: "General Shift",
          start_time: "09:00",
          end_time: "18:00",
          color: "#4f46e5",
          organizationId,
          is_active: true,
        },
        {
          name: "Morning Shift",
          start_time: "06:00",
          end_time: "14:30",
          color: "#059669",
          organizationId,
          is_active: true,
        },
        {
          name: "Evening Shift",
          start_time: "14:00",
          end_time: "22:30",
          color: "#d97706",
          organizationId,
          is_active: true,
        },
        {
          name: "Night Shift",
          start_time: "22:00",
          end_time: "06:30",
          color: "#9333ea",
          organizationId,
          is_active: true,
        },
      ];

      try {
        await Shift.insertMany(defaultShifts, { ordered: false });
        shifts = await Shift.find({ organizationId }).sort({ createdAt: -1 });
      } catch (seedErr) {
        console.warn("Auto-seeding default shifts warning:", seedErr.message);
        shifts = await Shift.find({ organizationId }).sort({ createdAt: -1 });
      }
    }

    // Aggregate group count for each shift
    const shiftsWithCount = await Promise.all(
      shifts.map(async (shift) => {
        const groupCount = await ShiftGroup.countDocuments({
          organizationId,
          shift_id: shift._id,
        });
        const shiftObj = shift.toObject ? shift.toObject() : { ...shift };
        shiftObj.assignedGroupCount = groupCount;
        return shiftObj;
      })
    );

    return res.status(200).json({
      success: true,
      count: shiftsWithCount.length,
      data: shiftsWithCount,
    });
  } catch (error) {
    console.error("getAllShifts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shifts",
      error: error.message,
    });
  }
};

/**
 * 2. Create Shift Definition
 * POST /api/shifts
 */
export const createShift = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;

    const { name, start_time, end_time, color, is_active } = req.body;

    // Check duplicate name within same organization
    const existing = await Shift.findOne({
      organizationId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A shift named "${name.trim()}" already exists in your organization.`,
      });
    }

    const shift = await Shift.create({
      name: name.trim(),
      start_time: start_time.trim(),
      end_time: end_time.trim(),
      color: color ? color.trim() : "#4f46e5",
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      organizationId,
      created_by: req.user.id || req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Shift created successfully.",
      data: shift,
    });
  } catch (error) {
    console.error("createShift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create shift",
      error: error.message,
    });
  }
};

/**
 * 3. Update Shift Definition
 * PUT /api/shifts/:id
 */
export const updateShift = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;
    const { id } = req.params;

    const shift = await Shift.findOne({ _id: id, organizationId });
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found.",
      });
    }

    const { name, start_time, end_time, color, is_active } = req.body;

    if (name && name.trim().toLowerCase() !== shift.name.toLowerCase()) {
      const duplicate = await Shift.findOne({
        _id: { $ne: id },
        organizationId,
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Another shift named "${name.trim()}" already exists.`,
        });
      }
      shift.name = name.trim();
    }

    const timingChanged =
      (start_time && start_time.trim() !== shift.start_time) ||
      (end_time && end_time.trim() !== shift.end_time);

    if (start_time) shift.start_time = start_time.trim();
    if (end_time) shift.end_time = end_time.trim();
    if (color) shift.color = color.trim();
    if (is_active !== undefined) shift.is_active = Boolean(is_active);

    await shift.save();

    // If timing changed, notify employees currently assigned to this shift
    if (timingChanged) {
      try {
        const groups = await ShiftGroup.find({ organizationId, shift_id: shift._id }).select("employee_ids");
        const allEmpIds = [];
        groups.forEach((g) => {
          if (Array.isArray(g.employee_ids)) {
            g.employee_ids.forEach((e) => allEmpIds.push(e));
          }
        });

        if (allEmpIds.length > 0) {
          await notifyShiftAssignment({
            employeeIds: allEmpIds,
            shift,
          });
        }
      } catch (notifErr) {
        console.warn("Could not notify employees on shift timing update:", notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Shift updated successfully.",
      data: shift,
    });
  } catch (error) {
    console.error("updateShift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update shift",
      error: error.message,
    });
  }
};

/**
 * 4. Delete Shift Definition
 * DELETE /api/shifts/:id
 * Blocks deletion if any ShiftGroup still references this shift.
 */
export const deleteShift = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;
    const { id } = req.params;

    const shift = await Shift.findOne({ _id: id, organizationId });
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found.",
      });
    }

    // Check referencing ShiftGroups
    const referencingGroups = await ShiftGroup.find({
      organizationId,
      shift_id: id,
    }).select("name");

    if (referencingGroups.length > 0) {
      const groupNames = referencingGroups.map((g) => `"${g.name}"`).join(", ");
      return res.status(400).json({
        success: false,
        message: `Cannot delete shift "${shift.name}" because it is currently assigned to ${referencingGroups.length} shift group(s): ${groupNames}. Please reassign or delete the group(s) first.`,
        referencingGroups,
      });
    }

    await Shift.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Shift "${shift.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("deleteShift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete shift",
      error: error.message,
    });
  }
};

/**
 * 5. Get My Assigned Shift (Lightweight endpoint for Employee self-service)
 * GET /api/shifts/my-shift
 */
export const getMyShift = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const employee = await Employee.findOne({ user_id: userId })
      .populate("current_shift_id")
      .populate("current_shift_group_id", "name");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found for this account.",
      });
    }

    if (!employee.current_shift_id) {
      return res.status(200).json({
        success: true,
        hasShift: false,
        shift: null,
        group: null,
      });
    }

    return res.status(200).json({
      success: true,
      hasShift: true,
      shift: employee.current_shift_id,
      group: employee.current_shift_group_id,
    });
  } catch (error) {
    console.error("getMyShift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned shift",
      error: error.message,
    });
  }
};

// =========================================================================
// SHIFT GROUPS & BULK ASSIGNMENTS
// =========================================================================

/**
 * 6. Get All Shift Groups
 * GET /api/shift-groups
 */
export const getAllShiftGroups = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;

    const groups = await ShiftGroup.find({ organizationId })
      .populate("shift_id")
      .populate({
        path: "employee_ids",
        populate: {
          path: "user_id department_id",
          select: "name email departmentName departmentId",
        },
        select: "employee_code designation employment_status user_id department_id",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: groups.length,
      data: groups,
    });
  } catch (error) {
    console.error("getAllShiftGroups error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shift groups",
      error: error.message,
    });
  }
};

/**
 * 7. Create Shift Group
 * POST /api/shift-groups
 */
export const createShiftGroup = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;

    const { name, shift_id, employee_ids = [] } = req.body;

    // Verify shift exists in this organization
    const shift = await Shift.findOne({ _id: shift_id, organizationId });
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found in your organization.",
      });
    }

    // Check duplicate group name
    const existingGroup = await ShiftGroup.findOne({
      organizationId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: `A shift group named "${name.trim()}" already exists.`,
      });
    }

    // Validate and fetch employees
    const validEmployees = await Employee.find({
      _id: { $in: employee_ids },
      organizationId,
    }).populate("user_id", "_id name email");

    const validEmpIds = validEmployees.map((e) => e._id);

    const group = await ShiftGroup.create({
      name: name.trim(),
      organizationId,
      shift_id,
      employee_ids: validEmpIds,
      created_by: req.user.id || req.user._id,
      assigned_at: new Date(),
    });

    // Cascade update on every member employee
    if (validEmpIds.length > 0) {
      await Employee.updateMany(
        { _id: { $in: validEmpIds } },
        { current_shift_id: shift._id, current_shift_group_id: group._id }
      );

      // Notify all member employees
      await notifyShiftAssignment({
        employees: validEmployees,
        shift,
      });
    }

    const populatedGroup = await ShiftGroup.findById(group._id)
      .populate("shift_id")
      .populate({
        path: "employee_ids",
        populate: { path: "user_id department_id", select: "name email departmentName" },
      });

    return res.status(201).json({
      success: true,
      message: `Shift group "${group.name}" created with ${validEmpIds.length} employee(s).`,
      data: populatedGroup,
    });
  } catch (error) {
    console.error("createShiftGroup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create shift group",
      error: error.message,
    });
  }
};

/**
 * 8. Update Shift Group (Modify name, members, or shift)
 * PUT /api/shift-groups/:id
 */
export const updateShiftGroup = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;
    const { id } = req.params;

    const group = await ShiftGroup.findOne({ _id: id, organizationId });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Shift group not found.",
      });
    }

    const { name, shift_id, employee_ids } = req.body;

    if (name && name.trim().toLowerCase() !== group.name.toLowerCase()) {
      const duplicate = await ShiftGroup.findOne({
        _id: { $ne: id },
        organizationId,
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Another shift group named "${name.trim()}" already exists.`,
        });
      }
      group.name = name.trim();
    }

    let targetShift = null;
    let shiftChanged = false;

    if (shift_id && String(shift_id) !== String(group.shift_id)) {
      targetShift = await Shift.findOne({ _id: shift_id, organizationId });
      if (!targetShift) {
        return res.status(404).json({
          success: false,
          message: "Shift not found in your organization.",
        });
      }
      group.shift_id = targetShift._id;
      group.assigned_at = new Date();
      shiftChanged = true;
    } else {
      targetShift = await Shift.findById(group.shift_id);
    }

    let removedIds = [];
    let addedIds = [];

    if (employee_ids !== undefined && Array.isArray(employee_ids)) {
      const oldIds = (group.employee_ids || []).map(String);
      const newIds = employee_ids.map(String);

      removedIds = oldIds.filter((empId) => !newIds.includes(empId));
      addedIds = newIds.filter((empId) => !oldIds.includes(empId));

      group.employee_ids = newIds;
    }

    await group.save();

    // 1. Handle Removed Employees: clear shift if still assigned to this group, notify removal
    if (removedIds.length > 0) {
      await Employee.updateMany(
        { _id: { $in: removedIds }, current_shift_group_id: group._id },
        { current_shift_id: null, current_shift_group_id: null }
      );

      await notifyShiftAssignment({
        employeeIds: removedIds,
        shift: targetShift,
        isRemoval: true,
      });
    }

    // 2. Handle Added Employees: sync shift and group
    if (addedIds.length > 0) {
      await Employee.updateMany(
        { _id: { $in: addedIds } },
        { current_shift_id: group.shift_id, current_shift_group_id: group._id }
      );

      await notifyShiftAssignment({
        employeeIds: addedIds,
        shift: targetShift,
      });
    }

    // 3. If Shift Changed: sync all existing members (except newly added which were already notified)
    if (shiftChanged) {
      const existingRemaining = group.employee_ids.filter((id) => !addedIds.includes(String(id)));
      if (existingRemaining.length > 0) {
        await Employee.updateMany(
          { _id: { $in: existingRemaining } },
          { current_shift_id: group.shift_id, current_shift_group_id: group._id }
        );

        await notifyShiftAssignment({
          employeeIds: existingRemaining,
          shift: targetShift,
        });
      }
    }

    const updated = await ShiftGroup.findById(group._id)
      .populate("shift_id")
      .populate({
        path: "employee_ids",
        populate: { path: "user_id department_id", select: "name email departmentName" },
      });

    return res.status(200).json({
      success: true,
      message: "Shift group updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("updateShiftGroup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update shift group",
      error: error.message,
    });
  }
};

/**
 * 9. Explicit Action: Assign / Reassign Shift to Group
 * POST /api/shift-groups/:id/assign-shift
 */
export const assignShiftToGroup = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;
    const { id } = req.params;
    const { shift_id } = req.body;

    const group = await ShiftGroup.findOne({ _id: id, organizationId });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Shift group not found.",
      });
    }

    const shift = await Shift.findOne({ _id: shift_id, organizationId });
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found in your organization.",
      });
    }

    group.shift_id = shift._id;
    group.assigned_at = new Date();
    await group.save();

    // Cascade update all members
    const memberIds = group.employee_ids || [];
    if (memberIds.length > 0) {
      await Employee.updateMany(
        { _id: { $in: memberIds } },
        { current_shift_id: shift._id, current_shift_group_id: group._id }
      );

      const members = await Employee.find({ _id: { $in: memberIds } })
        .populate("user_id", "_id name email");

      await notifyShiftAssignment({
        employees: members,
        shift,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Shift "${shift.name}" assigned successfully to group "${group.name}". ${memberIds.length} employee(s) notified.`,
      count: memberIds.length,
      data: group,
    });
  } catch (error) {
    console.error("assignShiftToGroup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign shift to group",
      error: error.message,
    });
  }
};

/**
 * 10. Add Employees to Group
 * POST /api/shift-groups/:id/add-employees
 */
export const addEmployeesToGroup = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;
    const { id } = req.params;
    const { employee_ids = [] } = req.body;

    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "employee_ids must be a non-empty array of employee IDs.",
      });
    }

    const group = await ShiftGroup.findOne({ _id: id, organizationId });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Shift group not found.",
      });
    }

    const shift = await Shift.findById(group.shift_id);

    const existingSet = new Set((group.employee_ids || []).map(String));
    const toAdd = employee_ids.filter((eId) => !existingSet.has(String(eId)));

    if (toAdd.length === 0) {
      return res.status(200).json({
        success: true,
        message: "All selected employees are already members of this group.",
        data: group,
      });
    }

    // Verify they belong to organization
    const validEmployees = await Employee.find({
      _id: { $in: toAdd },
      organizationId,
    }).populate("user_id", "_id name email");

    const validIds = validEmployees.map((e) => e._id);
    group.employee_ids.push(...validIds);
    await group.save();

    // Cascade update
    await Employee.updateMany(
      { _id: { $in: validIds } },
      { current_shift_id: group.shift_id, current_shift_group_id: group._id }
    );

    // Notify newly added employees
    await notifyShiftAssignment({
      employees: validEmployees,
      shift,
    });

    return res.status(200).json({
      success: true,
      message: `Added ${validIds.length} employee(s) to group "${group.name}".`,
      addedCount: validIds.length,
      data: group,
    });
  } catch (error) {
    console.error("addEmployeesToGroup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add employees to shift group",
      error: error.message,
    });
  }
};

/**
 * 11. Remove Employee from Group
 * DELETE /api/shift-groups/:id/employees/:employeeId
 */
export const removeEmployeeFromGroup = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;
    const { id, employeeId } = req.params;

    const group = await ShiftGroup.findOne({ _id: id, organizationId });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Shift group not found.",
      });
    }

    const shift = await Shift.findById(group.shift_id);

    const initialCount = group.employee_ids.length;
    group.employee_ids = group.employee_ids.filter((e) => String(e) !== String(employeeId));

    if (group.employee_ids.length === initialCount) {
      return res.status(404).json({
        success: false,
        message: "Employee is not a member of this shift group.",
      });
    }

    await group.save();

    // Clear employee's active shift if they were pointing to this group
    await Employee.findOneAndUpdate(
      { _id: employeeId, current_shift_group_id: group._id },
      { current_shift_id: null, current_shift_group_id: null }
    );

    // Notify employee of removal
    await notifyShiftAssignment({
      employeeIds: [employeeId],
      shift,
      isRemoval: true,
    });

    return res.status(200).json({
      success: true,
      message: `Employee removed from group "${group.name}".`,
      data: group,
    });
  } catch (error) {
    console.error("removeEmployeeFromGroup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove employee from group",
      error: error.message,
    });
  }
};

/**
 * 12. Delete Shift Group
 * DELETE /api/shift-groups/:id
 */
export const deleteShiftGroup = async (req, res) => {
  try {
    const orgCheck = resolveUserOrg(req);
    if (orgCheck.error) {
      return res.status(orgCheck.error.status).json({ success: false, message: orgCheck.error.message });
    }
    const { organizationId } = orgCheck;
    const { id } = req.params;

    const group = await ShiftGroup.findOne({ _id: id, organizationId });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Shift group not found.",
      });
    }

    const shift = await Shift.findById(group.shift_id);
    const memberIds = group.employee_ids || [];

    // Clear employee shift links
    if (memberIds.length > 0) {
      await Employee.updateMany(
        { current_shift_group_id: group._id },
        { current_shift_id: null, current_shift_group_id: null }
      );

      await notifyShiftAssignment({
        employeeIds: memberIds,
        shift,
        isRemoval: true,
      });
    }

    await ShiftGroup.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Shift group "${group.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("deleteShiftGroup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete shift group",
      error: error.message,
    });
  }
};
