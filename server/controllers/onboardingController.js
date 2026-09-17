import OnboardingProcess from "../models/OnboardingProcess.js";
import OffboardingProcess from "../models/OffboardingProcess.js";
import Employee from "../models/Employee.js";
import Candidate from "../models/Candidate.js";
import { DEFAULT_ONBOARDING_TASKS } from "../config/checklistTemplates.js";
import { normalizeRole } from "../middlewares/authMiddleware.js";
import { createNotification } from "../services/notificationService.js";

/**
 * 1. Create Onboarding Process
 * POST /api/onboarding
 */
export const createOnboarding = async (req, res) => {
  try {
    const { employee_id, checklist } = req.body;
    const userId = req.user?.id || req.user?._id;

    // Verify employee
    const employee = await Employee.findById(employee_id).populate("user_id");
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if an active / in-progress onboarding already exists
    const activeExisting = await OnboardingProcess.findOne({
      employee_id,
      status: { $in: ["In Progress", "Pending"] },
    });
    if (activeExisting) {
      return res.status(400).json({
        success: false,
        message: "An active onboarding process is already in progress for this employee.",
        onboarding: activeExisting,
      });
    }

    // If employee is already Active and already has an onboarding record, block duplicate
    if (employee.employment_status === "Active") {
      const anyExisting = await OnboardingProcess.findOne({ employee_id });
      if (anyExisting) {
        return res.status(400).json({
          success: false,
          message: "Employee is currently active and already has an onboarding record.",
          onboarding: anyExisting,
        });
      }
    }

    const taskItems =
      Array.isArray(checklist) && checklist.length > 0
        ? checklist
        : DEFAULT_ONBOARDING_TASKS.map((t) => ({ ...t }));

    const resolvedStartDate = req.body.start_date
      ? new Date(req.body.start_date)
      : (employee.date_of_joining ? new Date(employee.date_of_joining) : new Date());

    const onboarding = await OnboardingProcess.create({
      employee_id,
      organizationId: req.user?.organizationId || employee.organizationId || null,
      status: "In Progress",
      checklist: taskItems,
      start_date: resolvedStartDate,
      created_by: userId,
    });

    // Notify employee
    if (employee.user_id) {
      const recipientId = employee.user_id._id || employee.user_id;
      await createNotification({
        recipient: recipientId,
        type: "onboarding_updated",
        message: "Your employee onboarding process has been initiated.",
        link: "/employee/onboarding",
      });
    }

    const populated = await OnboardingProcess.findById(onboarding._id).populate({
      path: "employee_id",
      populate: { path: "user_id department_id" },
    });

    return res.status(201).json({
      success: true,
      message: "Onboarding process initiated successfully.",
      onboarding: populated,
    });
  } catch (error) {
    console.error("createOnboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate onboarding",
      error: error.message,
    });
  }
};

/**
 * 2. Get All Onboarding Processes
 * GET /api/onboarding
 */
export const getAllOnboarding = async (req, res) => {
  try {
    const { status, search } = req.query;
    const userRole = normalizeRole(req.user?.role);
    const query = {};

    // Multi-tenant isolation: strictly scope by organizationId from authenticated token
    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    const list = await OnboardingProcess.find(query)
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id" },
      })
      .sort({ createdAt: -1 });

    // Client-side search filtering by employee name or code if provided
    let filtered = list;
    if (search) {
      const q = search.toLowerCase();
      filtered = list.filter((item) => {
        const emp = item.employee_id;
        const name = emp?.user_id?.name || "";
        const code = emp?.employee_code || "";
        return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
      });
    }

    return res.status(200).json({
      success: true,
      count: filtered.length,
      onboardingProcesses: filtered,
    });
  } catch (error) {
    console.error("getAllOnboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch onboarding processes",
      error: error.message,
    });
  }
};

/**
 * 3. Get Onboarding Process by ID
 * GET /api/onboarding/:id
 */
export const getOnboardingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    const query = { _id: id };
    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    const onboarding = await OnboardingProcess.findOne(query).populate({
      path: "employee_id",
      populate: { path: "user_id department_id manager_id" },
    });

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "Onboarding process not found",
      });
    }

    // RBAC: Staff or owner
    const isOwner =
      onboarding.employee_id?.user_id &&
      String(onboarding.employee_id.user_id._id || onboarding.employee_id.user_id) === String(userId);
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this onboarding process",
      });
    }

    return res.status(200).json({
      success: true,
      onboarding,
    });
  } catch (error) {
    console.error("getOnboardingById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch onboarding details",
      error: error.message,
    });
  }
};

/**
 * 4. Get Onboarding by Employee ID (or current logged-in employee)
 * GET /api/onboarding/employee/:employeeId
 */
export const getOnboardingByEmployee = async (req, res) => {
  try {
    let { employeeId } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (employeeId === "me") {
      const emp = await Employee.findOne({ user_id: userId });
      if (!emp) {
        return res.status(404).json({
          success: false,
          message: "Employee profile not found for current user",
        });
      }
      employeeId = emp._id;
    }

    const userRole = normalizeRole(req.user?.role);
    const query = { employee_id: employeeId };
    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    const onboarding = await OnboardingProcess.findOne(query)
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id manager_id" },
      })
      .sort({ createdAt: -1 });

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "No onboarding process found for this employee",
      });
    }

    return res.status(200).json({
      success: true,
      onboarding,
    });
  } catch (error) {
    console.error("getOnboardingByEmployee error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch onboarding process",
      error: error.message,
    });
  }
};

/**
 * 5. Update Checklist Item Status / Notes
 * PATCH /api/onboarding/:id/task/:taskId
 */
export const updateChecklistItem = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const { status, notes, due_date } = req.body;

    const onboarding = await OnboardingProcess.findById(id).populate({
      path: "employee_id",
      populate: { path: "user_id" },
    });

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "Onboarding process not found",
      });
    }

    const task = onboarding.checklist.id(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Checklist task item not found",
      });
    }

    if (status) {
      task.status = status;
      if (status === "Done") {
        task.completed_at = new Date();
      } else {
        task.completed_at = null;
      }
    }
    if (notes !== undefined) task.notes = notes;
    if (due_date !== undefined) task.due_date = due_date ? new Date(due_date) : null;

    // Check if all items are now Done
    const allDone = onboarding.checklist.every((t) => t.status === "Done");
    if (allDone && onboarding.status !== "Completed") {
      onboarding.status = "Completed";
      onboarding.completed_at = new Date();

      // Ensure Employee is Active and linked Candidate is ACTIVE
      // Only flip to Active if this onboarding process was created after the latest completed offboarding
      const empId = onboarding.employee_id?._id || onboarding.employee_id;
      if (empId) {
        let isEligibleToReactivate = true;
        try {
          const latestOffboarding = await OffboardingProcess.findOne({
            employee_id: empId,
            status: "Completed",
          }).sort({ completed_at: -1, createdAt: -1 });

          if (latestOffboarding?.completed_at) {
            isEligibleToReactivate =
              new Date(onboarding.createdAt) > new Date(latestOffboarding.completed_at);
          }
        } catch (offErr) {
          console.warn("Could not verify offboarding date:", offErr.message);
        }

        if (isEligibleToReactivate) {
          await Employee.findByIdAndUpdate(
            empId,
            { employment_status: "Active" },
            { new: true }
          );

          let userEmail = onboarding.employee_id?.user_id?.email;
          if (!userEmail) {
            try {
              const emp = await Employee.findById(empId).populate("user_id");
              userEmail = emp?.user_id?.email;
            } catch (e) {}
          }
          if (userEmail) {
            try {
              await Candidate.updateMany(
                { email: userEmail.toLowerCase().trim() },
                { status: "ACTIVE" }
              );
            } catch (candErr) {
              console.warn("Could not sync candidate status to ACTIVE:", candErr.message);
            }
          }
        }
      }
    } else if (!allDone && onboarding.status === "Completed") {
      onboarding.status = "In Progress";
      onboarding.completed_at = null;
    }

    await onboarding.save();

    // Notify employee of checklist update
    if (onboarding.employee_id?.user_id) {
      const recipientId = onboarding.employee_id.user_id._id || onboarding.employee_id.user_id;
      await createNotification({
        recipient: recipientId,
        type: "onboarding_updated",
        message: `Onboarding task "${task.task_name}" status was updated to: ${task.status}`,
        link: "/employee/onboarding",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Checklist item updated successfully",
      onboarding,
    });
  } catch (error) {
    console.error("updateChecklistItem error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update checklist item",
      error: error.message,
    });
  }
};

/**
 * 6. Mark Process Status
 * PATCH /api/onboarding/:id/status
 */
export const updateOnboardingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const onboarding = await OnboardingProcess.findById(id).populate({
      path: "employee_id",
      populate: { path: "user_id" },
    });

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "Onboarding process not found",
      });
    }

    onboarding.status = status;
    if (status === "Completed") {
      onboarding.completed_at = new Date();

      // Set the Employee's employment_status to Active & sync linked Candidate
      // Only flip to Active if this onboarding process was created after the latest completed offboarding
      const empId = onboarding.employee_id?._id || onboarding.employee_id;
      if (empId) {
        let isEligibleToReactivate = true;
        try {
          const latestOffboarding = await OffboardingProcess.findOne({
            employee_id: empId,
            status: "Completed",
          }).sort({ completed_at: -1, createdAt: -1 });

          if (latestOffboarding?.completed_at) {
            isEligibleToReactivate =
              new Date(onboarding.createdAt) > new Date(latestOffboarding.completed_at);
          }
        } catch (offErr) {
          console.warn("Could not verify offboarding date:", offErr.message);
        }

        if (isEligibleToReactivate) {
          await Employee.findByIdAndUpdate(
            empId,
            { employment_status: "Active" },
            { new: true }
          );

          let userEmail = onboarding.employee_id?.user_id?.email;
          if (!userEmail) {
            try {
              const emp = await Employee.findById(empId).populate("user_id");
              userEmail = emp?.user_id?.email;
            } catch (e) {}
          }
          if (userEmail) {
            try {
              await Candidate.updateMany(
                { email: userEmail.toLowerCase().trim() },
                { status: "ACTIVE" }
              );
            } catch (candErr) {
              console.warn("Could not sync candidate status to ACTIVE:", candErr.message);
            }
          }
        }
      }
    } else {
      onboarding.completed_at = null;
    }

    await onboarding.save();

    return res.status(200).json({
      success: true,
      message: `Onboarding status updated to ${status}`,
      onboarding,
    });
  } catch (error) {
    console.error("updateOnboardingStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update onboarding status",
      error: error.message,
    });
  }
};

/**
 * 7. Get Employee Lifecycle History (All Onboardings & Offboardings)
 * GET /api/onboarding/employee/:employeeId/history
 */
export const getEmployeeLifecycleHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const onboardings = await OnboardingProcess.find({ employee_id: employeeId })
      .populate("created_by", "name email")
      .sort({ createdAt: 1 });

    const offboardings = await OffboardingProcess.find({ employee_id: employeeId })
      .populate("initiated_by", "name email")
      .sort({ createdAt: 1 });

    // Format into unified timeline events
    const timeline = [];
    for (const ob of onboardings) {
      timeline.push({
        _id: ob._id,
        type: "ONBOARDING",
        status: ob.status,
        date: ob.start_date || ob.createdAt,
        createdAt: ob.createdAt,
        completed_at: ob.completed_at,
        tasksTotal: ob.checklist?.length || 0,
        tasksDone: ob.checklist?.filter((t) => t.status === "Done").length || 0,
        createdBy: ob.created_by?.name || "System/HR",
      });
    }
    for (const off of offboardings) {
      timeline.push({
        _id: off._id,
        type: "OFFBOARDING",
        status: off.status,
        date: off.last_working_day || off.resignation_date || off.createdAt,
        createdAt: off.createdAt,
        completed_at: off.completed_at,
        resignation_date: off.resignation_date,
        last_working_day: off.last_working_day,
        exit_reason: off.exit_reason,
        tasksTotal: off.checklist?.length || 0,
        tasksDone: off.checklist?.filter((t) => t.status === "Done").length || 0,
        initiatedBy: off.initiated_by?.name || "HR",
        experience_letter_generated_at: off.experience_letter_generated_at,
      });
    }

    timeline.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return res.status(200).json({
      success: true,
      onboardings,
      offboardings,
      timeline,
    });
  } catch (error) {
    console.error("getEmployeeLifecycleHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lifecycle history",
      error: error.message,
    });
  }
};

