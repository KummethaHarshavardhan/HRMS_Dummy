import mongoose from "mongoose";
import OffboardingProcess from "../models/OffboardingProcess.js";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import OnboardingProcess from "../models/OnboardingProcess.js";
import TaskAssignment from "../models/TaskAssignment.js";
import Candidate from "../models/Candidate.js";
import Payroll from "../models/Payroll.js";
import AssetAssignment from "../models/AssetAssignment.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import Document from "../models/Document.js";
import PFLedger from "../models/PFLedger.js";
import { DEFAULT_OFFBOARDING_TASKS } from "../config/checklistTemplates.js";
import { normalizeRole } from "../middlewares/authMiddleware.js";
import { createNotification } from "../services/notificationService.js";
import { createExperienceLetterPDF } from "../services/experienceLetterService.js";
import {
  createNoDuesCertificatePDF,
  createRelievingLetterPDF,
  createAttendanceSummaryPDF,
  createLeaveSummaryPDF,
} from "../services/exitDocumentService.js";

/**
 * 1. Initiate Offboarding Process
 * POST /api/offboarding
 */
export const createOffboarding = async (req, res) => {
  try {
    const { employee_id, resignation_date, last_working_day, exit_reason, checklist } = req.body;
    const userId = req.user?.id || req.user?._id;

    // Verify employee
    const employee = await Employee.findById(employee_id).populate("user_id");
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if an active offboarding process is already in progress
    const existing = await OffboardingProcess.findOne({ employee_id, status: "In Progress" });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An active offboarding process is already in progress for this employee.",
        offboarding: existing,
      });
    }

    const taskItems =
      Array.isArray(checklist) && checklist.length > 0
        ? checklist
        : DEFAULT_OFFBOARDING_TASKS.map((t) => ({ ...t }));

    const offboarding = await OffboardingProcess.create({
      employee_id,
      organizationId: req.user?.organizationId || employee.organizationId || null,
      resignation_date: new Date(resignation_date),
      last_working_day: new Date(last_working_day),
      exit_reason: exit_reason || "",
      status: "In Progress",
      checklist: taskItems,
      clearance_status: {
        hr: { signed: false },
        it: { signed: false },
        finance: { signed: false },
        manager: { signed: false },
      },
      created_by: userId,
    });

    // Notify employee
    if (employee.user_id) {
      const recipientId = employee.user_id._id || employee.user_id;
      await createNotification({
        recipient: recipientId,
        type: "offboarding_updated",
        message: "Your exit offboarding and clearance process has been initiated.",
        link: "/employee/offboarding",
      });
    }

    const populated = await OffboardingProcess.findById(offboarding._id).populate({
      path: "employee_id",
      populate: { path: "user_id department_id" },
    });

    return res.status(201).json({
      success: true,
      message: "Offboarding process initiated successfully.",
      offboarding: populated,
    });
  } catch (error) {
    console.error("createOffboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate offboarding",
      error: error.message,
    });
  }
};

/**
 * 2. Get All Offboarding Processes
 * GET /api/offboarding
 */
export const getAllOffboarding = async (req, res) => {
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

    const list = await OffboardingProcess.find(query)
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id" },
      })
      .sort({ createdAt: -1 });

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
      offboardingProcesses: filtered,
    });
  } catch (error) {
    console.error("getAllOffboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch offboarding processes",
      error: error.message,
    });
  }
};

/**
 * 3. Get Offboarding Process by ID
 * GET /api/offboarding/:id
 */
export const getOffboardingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    const query = { _id: id };
    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    const offboarding = await OffboardingProcess.findOne(query)
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id manager_id" },
      })
      .populate(
        "clearance_status.hr.signed_by clearance_status.it.signed_by clearance_status.finance.signed_by clearance_status.manager.signed_by",
        "name email role"
      );

    if (!offboarding) {
      return res.status(404).json({
        success: false,
        message: "Offboarding process not found",
      });
    }

    const isOwner =
      offboarding.employee_id?.user_id &&
      String(offboarding.employee_id.user_id._id || offboarding.employee_id.user_id) === String(userId);
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this offboarding process",
      });
    }

    return res.status(200).json({
      success: true,
      offboarding,
    });
  } catch (error) {
    console.error("getOffboardingById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch offboarding details",
      error: error.message,
    });
  }
};

/**
 * 4. Get Offboarding by Employee
 * GET /api/offboarding/employee/:employeeId
 */
export const getOffboardingByEmployee = async (req, res) => {
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

    const offboarding = await OffboardingProcess.findOne(query)
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id manager_id" },
      })
      .populate(
        "clearance_status.hr.signed_by clearance_status.it.signed_by clearance_status.finance.signed_by clearance_status.manager.signed_by",
        "name email role"
      );

    if (!offboarding) {
      return res.status(404).json({
        success: false,
        message: "No offboarding process found for this employee",
      });
    }

    return res.status(200).json({
      success: true,
      offboarding,
    });
  } catch (error) {
    console.error("getOffboardingByEmployee error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch offboarding process",
      error: error.message,
    });
  }
};

/**
 * 5. Update Checklist Task Item
 * PATCH /api/offboarding/:id/task/:taskId
 */
export const updateChecklistItem = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const { status, notes, due_date } = req.body;

    const offboarding = await OffboardingProcess.findById(id).populate({
      path: "employee_id",
      populate: { path: "user_id" },
    });

    if (!offboarding) {
      return res.status(404).json({
        success: false,
        message: "Offboarding process not found",
      });
    }

    const task = offboarding.checklist.id(taskId);
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

    await offboarding.save();

    // Notify employee of checklist update
    if (offboarding.employee_id?.user_id) {
      const recipientId = offboarding.employee_id.user_id._id || offboarding.employee_id.user_id;
      await createNotification({
        recipient: recipientId,
        type: "offboarding_updated",
        message: `Offboarding checklist item "${task.task_name}" updated to: ${task.status}`,
        link: "/employee/offboarding",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Offboarding checklist item updated",
      offboarding,
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
 * 6. Department Clearance Sign-Off
 * PATCH /api/offboarding/:id/clearance
 */
export const updateClearanceSignOff = async (req, res) => {
  try {
    const { id } = req.params;
    const { department, signed, comments } = req.body;
    const userId = req.user?.id || req.user?._id;

    const deptKey = String(department).toLowerCase();
    const offboarding = await OffboardingProcess.findById(id).populate({
      path: "employee_id",
      populate: { path: "user_id" },
    });

    if (!offboarding) {
      return res.status(404).json({
        success: false,
        message: "Offboarding process not found",
      });
    }

    if (!offboarding.clearance_status[deptKey]) {
      offboarding.clearance_status[deptKey] = {};
    }

    offboarding.clearance_status[deptKey].signed = Boolean(signed);
    offboarding.clearance_status[deptKey].signed_by = signed ? userId : null;
    offboarding.clearance_status[deptKey].signed_at = signed ? new Date() : null;
    if (comments !== undefined) {
      offboarding.clearance_status[deptKey].comments = comments;
    }

    // Mark clearance_status as modified so Mongoose saves the nested object
    offboarding.markModified("clearance_status");
    await offboarding.save();

    // Notify employee
    if (offboarding.employee_id?.user_id) {
      const recipientId = offboarding.employee_id.user_id._id || offboarding.employee_id.user_id;
      const deptName = deptKey.toUpperCase();
      await createNotification({
        recipient: recipientId,
        type: "offboarding_updated",
        message: `${deptName} department clearance was ${signed ? "approved & signed" : "revoked"}.`,
        link: "/employee/offboarding",
      });
    }

    const reloaded = await OffboardingProcess.findById(id)
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id" },
      })
      .populate(
        "clearance_status.hr.signed_by clearance_status.it.signed_by clearance_status.finance.signed_by clearance_status.manager.signed_by",
        "name email role"
      );

    return res.status(200).json({
      success: true,
      message: `${deptKey.toUpperCase()} clearance sign-off updated`,
      offboarding: reloaded,
    });
  } catch (error) {
    console.error("updateClearanceSignOff error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update clearance sign-off",
      error: error.message,
    });
  }
};

/**
 * 7. Complete Offboarding
 * PATCH /api/offboarding/:id/status
 * When completed, automatically updates Employee's employment_status to "Inactive"
 */
export const completeOffboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const offboarding = await OffboardingProcess.findById(id).populate({
      path: "employee_id",
      populate: { path: "user_id" },
    });

    if (!offboarding) {
      return res.status(404).json({
        success: false,
        message: "Offboarding process not found",
      });
    }

    offboarding.status = status || "Completed";
    if (offboarding.status === "Completed") {
      offboarding.completed_at = new Date();

      // Set the Employee's employment_status to Inactive & sync linked Candidate
      const empId = offboarding.employee_id?._id || offboarding.employee_id;
      if (empId) {
        await Employee.findByIdAndUpdate(
          empId,
          { employment_status: "Inactive" },
          { new: true }
        );

        let userEmail = offboarding.employee_id?.user_id?.email;
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
              { status: "INACTIVE" }
            );
          } catch (candErr) {
            console.warn("Could not sync candidate status to INACTIVE:", candErr.message);
          }
        }
      }

      // Automatically initialize experience letter record on completion
      if (!offboarding.experience_letter_generated_at) {
        offboarding.experience_letter_generated_at = new Date();
        offboarding.experience_letter_url = `/api/offboarding/${offboarding._id}/experience-letter`;
      }

      // Automatically settle Provident Fund (PF) upon completion (idempotent)
      var isFirstPfSettlement = false;
      var settledPfAmount = 0;
      if (!offboarding.pf_settled) {
        let totalPf = 0;
        try {
          const pfLedger = await PFLedger.findOne({ employee_id: empId });
          if (pfLedger?.total_accumulated_pf) {
            totalPf = pfLedger.total_accumulated_pf;
          }
        } catch (pfErr) {
          console.warn("PF ledger lookup error in completeOffboarding:", pfErr.message);
        }

        if (!totalPf) {
          try {
            const payrolls = await Payroll.find({ employeeId: empId, status: "Paid" });
            totalPf = payrolls.reduce((sum, p) => sum + (p.pf_amount || 0), 0);
          } catch (payErr) {
            console.warn("Payroll PF fallback error in completeOffboarding:", payErr.message);
          }
        }

        offboarding.pf_settled = true;
        offboarding.pf_settled_at = new Date();
        offboarding.pf_settlement_amount = totalPf;
        offboarding.pf_settled_by = req.user?.id || req.user?._id || null;
        settledPfAmount = totalPf;
        isFirstPfSettlement = true;
      }
    } else {
      offboarding.completed_at = null;
    }

    await offboarding.save();

    // Notify employee of offboarding completion, experience letter & PF settlement
    if (offboarding.employee_id?.user_id) {
      const recipientId = offboarding.employee_id.user_id._id || offboarding.employee_id.user_id;
      await createNotification({
        recipient: recipientId,
        type: "offboarding_updated",
        message: "Your offboarding has been completed. Wishing you all the best!",
        link: "/employee/offboarding",
      });

      if (offboarding.status === "Completed") {
        await createNotification({
          recipient: recipientId,
          type: "offboarding_updated",
          message: "Your experience letter is ready to download.",
          link: "/employee/offboarding",
        });

        if (isFirstPfSettlement) {
          const bankNumber = (
            offboarding.employee_id?.bank_account_number ||
            offboarding.employee_id?.account_number ||
            ""
          ).trim();
          const accountClause = bankNumber ? `your account ${bankNumber}` : "your account";

          await createNotification({
            recipient: recipientId,
            type: "offboarding_updated",
            message: `Your accumulated PF of ₹${settledPfAmount.toLocaleString("en-IN")} has been settled and credited to ${accountClause} as part of your final settlement.`,
            link: "/employee/offboarding",
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Offboarding marked as ${offboarding.status}. Employee status updated to Inactive.`,
      offboarding,
    });
  } catch (error) {
    console.error("completeOffboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update offboarding status",
      error: error.message,
    });
  }
};

/**
 * 8. Generate / Download Experience Letter PDF
 * GET /api/offboarding/:id/experience-letter
 * Query: ?regenerate=true (HR/Admin only)
 */
export const generateExperienceLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);
    const wantsRegenerate = req.query.regenerate === "true" || req.query.regenerate === true;

    // 1. Super Admin is strictly blocked (organization-level document)
    if (userRole === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super Admin does not manage tenant experience letters.",
      });
    }

    // 2. Fetch Offboarding record with populated employee and user
    const offboarding = await OffboardingProcess.findById(id).populate({
      path: "employee_id",
      populate: [
        { path: "user_id", select: "name email role organizationId department phone" },
        { path: "department_id", select: "departmentName" },
      ],
    });

    if (!offboarding) {
      return res.status(404).json({
        success: false,
        message: "Offboarding process not found.",
      });
    }

    // 3. Status Guard: Must be Completed
    if (offboarding.status !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "Experience letter can only be generated once offboarding is Completed.",
      });
    }

    let employee = offboarding.employee_id;
    if (employee && !employee.date_of_joining) {
      const empId = employee._id || employee;
      if (mongoose.isValidObjectId(empId)) {
        try {
          const fullEmp = await Employee.findById(empId).populate([
            { path: "user_id", select: "name email role organizationId department phone" },
            { path: "department_id", select: "departmentName" },
          ]);
          if (fullEmp) {
            employee = fullEmp;
          }
        } catch (empErr) {
          console.warn("Could not reload full employee for date_of_joining:", empErr.message);
        }
      }
    }

    const employeeUserId = employee?.user_id?._id || employee?.user_id;
    const isEmployeeSelf = String(employeeUserId) === String(userId);
    const isStaff = userRole === "admin" || userRole === "hr_manager";

    // 4. Role & Multi-Tenant Access Control
    if (isStaff) {
      // Organization scoping: staff cannot generate for another organization
      if (req.user?.organizationId && offboarding.organizationId) {
        if (String(req.user.organizationId) !== String(offboarding.organizationId)) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Employee belongs to another organization.",
          });
        }
      }
    } else if (isEmployeeSelf) {
      // EXPLICIT CHECK: Employee cannot trigger regeneration
      if (wantsRegenerate) {
        return res.status(403).json({
          success: false,
          message: "Employees are not authorized to regenerate experience letters. Contact HR for revisions.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied to this experience letter.",
      });
    }

    // 5. Fetch Organization
    const orgId = offboarding.organizationId || employee?.organizationId || req.user?.organizationId;
    let organization = null;
    if (orgId) {
      organization = await Organization.findById(orgId);
    }

    // 6. Fetch Start Date: OnboardingProcess.start_date first, then Employee.date_of_joining (never new Date())
    let startDate = null;
    try {
      const empId = employee?._id || offboarding.employee_id?._id || offboarding.employee_id;
      if (empId) {
        const onboarding = await OnboardingProcess.findOne({ employee_id: empId });
        if (onboarding?.start_date) {
          startDate = onboarding.start_date;
        }
      }
    } catch (e) {
      console.warn("Could not fetch onboarding record for start_date:", e.message);
    }

    if (!startDate && employee?.date_of_joining) {
      startDate = employee.date_of_joining;
    }

    // 7. Fetch distinct tasks/projects assigned to employee
    let distinctTaskTitles = [];
    try {
      const userEmail = employee?.user_id?.email;
      const candidateQuery = { $or: [] };
      if (userEmail) candidateQuery.$or.push({ email: userEmail.toLowerCase().trim() });
      if (employee?._id) candidateQuery.$or.push({ _id: employee._id });

      const candidateIds = [];
      if (candidateQuery.$or.length > 0) {
        const candidates = await Candidate.find(candidateQuery).select("_id");
        candidates.forEach((c) => candidateIds.push(c._id));
      }

      const assignmentFilter = {
        $or: [
          ...(candidateIds.length > 0 ? [{ candidate: { $in: candidateIds } }] : []),
          ...(employee?._id ? [{ candidate: employee._id }] : []),
          ...(employeeUserId ? [{ candidate: employeeUserId }] : []),
        ],
      };

      if (assignmentFilter.$or.length > 0) {
        const assignments = await TaskAssignment.find(assignmentFilter).populate("task", "title");
        const titles = assignments
          .map((a) => a.task?.title)
          .filter(Boolean);
        distinctTaskTitles = [...new Set(titles)];
      }
    } catch (taskErr) {
      console.warn("Error fetching task assignments for experience letter:", taskErr.message);
    }

    // 8. Update generation tracking timestamp on record
    const isFirstGeneration = !offboarding.experience_letter_generated_at;
    offboarding.experience_letter_generated_at = new Date();
    offboarding.experience_letter_url = `/api/offboarding/${offboarding._id}/experience-letter`;
    await offboarding.save();

    // Trigger notification if first generation
    if (isFirstGeneration && employeeUserId) {
      try {
        await createNotification({
          recipient: employeeUserId,
          type: "offboarding_updated",
          message: "Your experience letter is ready to download.",
          link: "/employee/offboarding",
        });
      } catch (notifErr) {
        console.warn("Error triggering experience letter notification:", notifErr.message);
      }
    }

    // 9. Generate PDF stream using experienceLetterService
    const doc = createExperienceLetterPDF({
      offboarding,
      employee,
      organization,
      startDate,
      tasks: distinctTaskTitles,
      signatoryName: req.user?.name ? `${req.user.name} (HR)` : "Human Resources Department",
    });

    const safeEmpName = (employee?.user_id?.name || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Experience_Letter_${safeEmpName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("generateExperienceLetter error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate experience letter PDF",
        error: error.message,
      });
    }
  }
};

/**
 * 9. Synchronize Offboarded Employees
 * Automatically runs on server startup to heal/reconcile any historical offboardings,
 * ensuring all employees with completed offboarding (and no newer completed rejoin onboarding)
 * have employment_status = "Inactive" and Candidate.status = "INACTIVE".
 */
export const syncOffboardedEmployees = async () => {
  try {
    try {
      await OnboardingProcess.collection.dropIndex("employee_id_1");
    } catch (e) {}
    try {
      await OffboardingProcess.collection.dropIndex("employee_id_1");
    } catch (e) {}

    const completedOffboardings = await OffboardingProcess.find({ status: "Completed" }).populate({
      path: "employee_id",
      populate: { path: "user_id" },
    });

    let syncedCount = 0;
    for (const off of completedOffboardings) {
      const empId = off.employee_id?._id || off.employee_id;
      if (!empId) continue;

      const newerOnboard = await OnboardingProcess.findOne({
        employee_id: empId,
        status: "Completed",
        createdAt: { $gt: off.completed_at || off.updatedAt },
      });

      if (!newerOnboard) {
        await Employee.findByIdAndUpdate(empId, { employment_status: "Inactive" });
        const userEmail = off.employee_id?.user_id?.email;
        if (userEmail) {
          try {
            await Candidate.updateMany(
              { email: userEmail.toLowerCase().trim() },
              { status: "INACTIVE" }
            );
          } catch (candErr) {}
        }
        syncedCount++;
      }
    }

    if (syncedCount > 0) {
      console.log(`[Offboarding Sync] Verified & synced ${syncedCount} offboarded employee(s) to Inactive.`);
    }
  } catch (err) {
    console.error("[Offboarding Sync] Error syncing offboarded employees:", err.message);
  }
};

/**
 * Helper: Resolve and authorize access to offboarding exit package documents
 */
const resolveOffboardingAccess = async (req, offboardingId) => {
  const userRole = normalizeRole(req.user?.role);
  if (userRole === "super_admin") {
    return {
      error: {
        status: 403,
        message: "Super Admin is not authorized to access organization offboarding documents.",
      },
    };
  }

  const offboarding = await OffboardingProcess.findById(offboardingId)
    .populate({
      path: "employee_id",
      populate: { path: "user_id department_id" },
    })
    .populate("organizationId");

  if (!offboarding) {
    return { error: { status: 404, message: "Offboarding process not found" } };
  }

  const employee = offboarding.employee_id;
  const user = employee?.user_id;

  const isStaff = userRole === "admin" || userRole === "hr_manager" || userRole === "hr";
  const isOwner =
    user && String(user._id || user.id) === String(req.user?.id || req.user?._id);

  if (!isStaff && !isOwner) {
    return { error: { status: 403, message: "Access denied to this employee's exit package" } };
  }

  if (isStaff && req.user?.organizationId) {
    const orgId = String(req.user.organizationId);
    const offOrgId = String(
      offboarding.organizationId?._id || offboarding.organizationId || employee?.organizationId
    );
    if (offOrgId && orgId !== offOrgId) {
      return { error: { status: 403, message: "Access denied: unauthorized organization" } };
    }
  }

  return { offboarding, employee, user, isStaff, isOwner };
};

/**
 * 10. Get Exit Package Details
 * GET /api/offboarding/:id/exit-package
 */
export const getExitPackageDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const access = await resolveOffboardingAccess(req, id);
    if (access.error) {
      return res.status(access.error.status).json({ success: false, message: access.error.message });
    }

    const { offboarding, employee } = access;
    const empId = employee?._id || offboarding.employee_id;

    // 1. Month-wise payslips from Payroll model
    const payrolls = await Payroll.find({ employeeId: empId })
      .sort({ year: -1, month: -1, createdAt: -1 });

    const payslips = payrolls.map((p) => ({
      _id: p._id,
      month: p.month,
      year: p.year,
      netSalary: p.netSalary,
      basicSalary: p.basicSalary,
      pfAmount: p.pf_amount || 0,
      status: p.status,
      paymentDate: p.paymentDate,
    }));

    const finalPayslip = payslips.length > 0 ? payslips[0] : null;

    // 2. Active assets
    const activeAssets = await AssetAssignment.find({
      employee_id: empId,
      status: "Active",
    });
    const activeAssetCount = activeAssets.length;

    // 3. Clearance complete check
    const c = offboarding.clearance_status || {};
    const isClearanceComplete = !!(c.hr?.signed && c.it?.signed && c.finance?.signed && c.manager?.signed);

    // 4. No dues certificate eligibility
    const noDuesEligible = activeAssetCount === 0 && isClearanceComplete;

    // 5. Other documents
    const otherDocuments = await Document.find({
      employee_id: empId,
      category: "Other",
    }).sort({ createdAt: -1 });

    // 6. Resolved start date
    let resolvedStartDate = employee?.date_of_joining || null;
    const onboarding = await OnboardingProcess.findOne({ employee_id: empId }).sort({ createdAt: -1 });
    if (onboarding?.start_date) {
      resolvedStartDate = onboarding.start_date;
    }

    // 7. Provident Fund (PF) balance and settlement
    let totalAccumulatedPf = 0;
    try {
      if (mongoose.Types.ObjectId.isValid(empId)) {
        const pfLedger = await PFLedger.findOne({ employee_id: empId });
        if (pfLedger?.total_accumulated_pf) {
          totalAccumulatedPf = pfLedger.total_accumulated_pf;
        }
      }
    } catch (pfErr) {
      console.error("PF ledger lookup error:", pfErr.message);
    }
    const payrollPfTotal = payrolls.reduce((sum, p) => sum + (p.pf_amount || 0), 0);
    if (!totalAccumulatedPf) totalAccumulatedPf = payrollPfTotal;

    const pfSettlement = {
      settled: !!offboarding.pf_settled,
      settledAt: offboarding.pf_settled_at || null,
      amount: offboarding.pf_settlement_amount !== undefined ? offboarding.pf_settlement_amount : (offboarding.pf_settled ? totalAccumulatedPf : 0),
      settledBy: offboarding.pf_settled_by || null,
    };

    return res.status(200).json({
      success: true,
      data: {
        payslips,
        finalPayslip,
        activeAssetCount,
        isClearanceComplete,
        noDuesEligible,
        otherDocuments,
        totalAccumulatedPf,
        pfSettlement,
        tenure: {
          startDate: resolvedStartDate,
          resignationDate: offboarding.resignation_date,
          lastWorkingDay: offboarding.last_working_day,
        },
      },
    });
  } catch (error) {
    console.error("getExitPackageDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch exit package details",
      error: error.message,
    });
  }
};

/**
 * 11. Download Attendance Summary PDF
 * GET /api/offboarding/:id/attendance-summary
 */
export const downloadAttendanceSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const access = await resolveOffboardingAccess(req, id);
    if (access.error) {
      return res.status(access.error.status).json({ success: false, message: access.error.message });
    }

    const { offboarding, employee } = access;
    const empId = employee?._id;
    const empCode = employee?.employee_code;

    let startDate = employee?.date_of_joining || new Date(offboarding.createdAt);
    const onboarding = await OnboardingProcess.findOne({ employee_id: empId }).sort({ createdAt: -1 });
    if (onboarding?.start_date) startDate = onboarding.start_date;

    const lastWorkingDay = offboarding.last_working_day ? new Date(offboarding.last_working_day) : new Date();

    const attendanceRecords = await Attendance.find({
      employeeId: { $in: [String(empId), empCode, empId] },
      date: { $gte: new Date(startDate), $lte: new Date(lastWorkingDay) },
    }).sort({ date: 1 });

    const organization =
      offboarding.organizationId || (await Organization.findById(employee?.organizationId));

    const doc = createAttendanceSummaryPDF({
      offboarding,
      employee,
      organization,
      attendanceRecords,
      startDate,
    });

    const safeName = (employee?.user_id?.name || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Attendance_Summary_${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("downloadAttendanceSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate attendance summary PDF",
      error: error.message,
    });
  }
};

/**
 * 12. Download Leave Summary PDF
 * GET /api/offboarding/:id/leave-summary
 */
export const downloadLeaveSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const access = await resolveOffboardingAccess(req, id);
    if (access.error) {
      return res.status(access.error.status).json({ success: false, message: access.error.message });
    }

    const { offboarding, employee } = access;
    const userId = employee?.user_id?._id || employee?.user_id;

    let startDate = employee?.date_of_joining || new Date(offboarding.createdAt);
    const onboarding = await OnboardingProcess.findOne({ employee_id: employee?._id }).sort({ createdAt: -1 });
    if (onboarding?.start_date) startDate = onboarding.start_date;

    const lastWorkingDay = offboarding.last_working_day ? new Date(offboarding.last_working_day) : new Date();

    const leaveRecords = await Leave.find({
      employee: userId,
      startDate: { $gte: new Date(startDate) },
      endDate: { $lte: new Date(lastWorkingDay) },
    }).sort({ startDate: -1 });

    const organization =
      offboarding.organizationId || (await Organization.findById(employee?.organizationId));

    const doc = createLeaveSummaryPDF({
      offboarding,
      employee,
      organization,
      leaveRecords,
      startDate,
    });

    const safeName = (employee?.user_id?.name || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Leave_Summary_${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("downloadLeaveSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate leave summary PDF",
      error: error.message,
    });
  }
};

/**
 * 13. Download No-Dues Certificate PDF
 * GET /api/offboarding/:id/no-dues-certificate
 */
export const downloadNoDuesCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const access = await resolveOffboardingAccess(req, id);
    if (access.error) {
      return res.status(access.error.status).json({ success: false, message: access.error.message });
    }

    const { offboarding, employee } = access;
    const empId = employee?._id;

    // Verify active assets
    const activeAssets = await AssetAssignment.find({
      employee_id: empId,
      status: "Active",
    });

    // Verify clearance sign-offs
    const c = offboarding.clearance_status || {};
    const isClearanceComplete = !!(c.hr?.signed && c.it?.signed && c.finance?.signed && c.manager?.signed);

    if (activeAssets.length > 0 || !isClearanceComplete) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot generate No-Dues Certificate: employee has unreturned company assets or incomplete department clearance sign-offs.",
        activeAssetCount: activeAssets.length,
        isClearanceComplete,
      });
    }

    const organization =
      offboarding.organizationId || (await Organization.findById(employee?.organizationId));

    const doc = createNoDuesCertificatePDF({
      offboarding,
      employee,
      organization,
    });

    const safeName = (employee?.user_id?.name || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `No_Dues_Certificate_${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("downloadNoDuesCertificate error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate No-Dues Certificate PDF",
      error: error.message,
    });
  }
};

/**
 * 14. Download Relieving Letter PDF
 * GET /api/offboarding/:id/relieving-letter
 */
export const downloadRelievingLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const access = await resolveOffboardingAccess(req, id);
    if (access.error) {
      return res.status(access.error.status).json({ success: false, message: access.error.message });
    }

    const { offboarding, employee } = access;
    const organization =
      offboarding.organizationId || (await Organization.findById(employee?.organizationId));

    const doc = createRelievingLetterPDF({
      offboarding,
      employee,
      organization,
    });

    const safeName = (employee?.user_id?.name || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Relieving_Letter_${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("downloadRelievingLetter error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate Relieving Letter PDF",
      error: error.message,
    });
  }
};

/**
 * 15. Settle Provident Fund (PF)
 * POST /api/offboarding/:id/settle-pf
 * Super Admin only. Allowed only when offboarding status is "Completed".
 */
export const settlePF = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = normalizeRole(req.user?.role);
    if (userRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only Super Admin can settle Provident Fund.",
      });
    }

    const offboarding = await OffboardingProcess.findById(id).populate({
      path: "employee_id",
      populate: { path: "user_id" },
    });

    if (!offboarding) {
      return res.status(404).json({ success: false, message: "Offboarding record not found" });
    }

    if (offboarding.status !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot settle PF: Offboarding process must be Completed first.",
      });
    }

    if (offboarding.pf_settled) {
      return res.status(400).json({
        success: false,
        message: `PF has already been settled on ${new Date(offboarding.pf_settled_at).toLocaleDateString()} for ₹${(offboarding.pf_settlement_amount || 0).toLocaleString("en-IN")}.`,
      });
    }

    const empId = offboarding.employee_id?._id || offboarding.employee_id;
    const pfLedger = await PFLedger.findOne({ employee_id: empId });
    const payrolls = await Payroll.find({ employeeId: empId, status: "Paid" });
    const payrollPfTotal = payrolls.reduce((sum, p) => sum + (p.pf_amount || 0), 0);
    const settlementAmount = pfLedger?.total_accumulated_pf || payrollPfTotal || 0;

    offboarding.pf_settled = true;
    offboarding.pf_settled_at = new Date();
    offboarding.pf_settlement_amount = settlementAmount;
    offboarding.pf_settled_by = req.user?.id || req.user?._id;
    await offboarding.save();

    // Create In-App Notification for employee
    const u = offboarding.employee_id?.user_id;
    if (u?._id) {
      await createNotification({
        recipient: u._id,
        type: "payroll",
        message: `Your Provident Fund (PF) settlement of ₹${settlementAmount.toLocaleString("en-IN")} has been approved and processed by Super Admin.`,
        link: "/employee/offboarding",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Provident Fund settlement of ₹${settlementAmount.toLocaleString("en-IN")} processed successfully.`,
      pfSettlement: {
        settled: true,
        settledAt: offboarding.pf_settled_at,
        amount: settlementAmount,
        settledBy: offboarding.pf_settled_by,
      },
    });
  } catch (error) {
    console.error("settlePF error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to settle Provident Fund",
      error: error.message,
    });
  }
};


