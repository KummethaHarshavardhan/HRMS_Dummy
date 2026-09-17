import Asset from "../models/Asset.js";
import AssetAssignment from "../models/AssetAssignment.js";
import Employee from "../models/Employee.js";
import { normalizeRole } from "../middlewares/authMiddleware.js";
import { createNotification } from "../services/notificationService.js";

/**
 * 1. Create Asset
 * POST /api/assets
 */
export const createAsset = async (req, res) => {
  try {
    const {
      asset_tag,
      type,
      brand,
      model,
      serial_number,
      purchase_date,
      status,
      condition,
      notes,
    } = req.body;

    const existing = await Asset.findOne({
      asset_tag: asset_tag.trim().toUpperCase(),
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Asset tag ${asset_tag.toUpperCase()} already exists.`,
      });
    }

    const asset = await Asset.create({
      asset_tag: asset_tag.trim().toUpperCase(),
      type,
      brand: brand.trim(),
      model: model.trim(),
      serial_number: serial_number ? serial_number.trim() : "",
      purchase_date: purchase_date ? new Date(purchase_date) : null,
      status: status || "Available",
      condition: condition || "Good",
      notes: notes || "",
      organizationId: req.user?.organizationId || null,
    });

    return res.status(201).json({
      success: true,
      message: "Asset created successfully.",
      asset,
    });
  } catch (error) {
    console.error("createAsset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create asset",
      error: error.message,
    });
  }
};

/**
 * 2. Get All Assets (with filter and search)
 * GET /api/assets
 */
export const getAllAssets = async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const userRole = normalizeRole(req.user?.role);
    const query = {};

    // Multi-tenant isolation: strictly scope by organizationId from authenticated token
    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    if (type && type !== "ALL") query.type = type;
    if (status && status !== "ALL") query.status = status;

    if (search) {
      const q = search.trim();
      query.$or = [
        { asset_tag: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { model: { $regex: q, $options: "i" } },
        { serial_number: { $regex: q, $options: "i" } },
      ];
    }

    const assets = await Asset.find(query)
      .populate({
        path: "current_assignment",
        populate: {
          path: "employee_id",
          populate: { path: "user_id department_id" },
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: assets.length,
      assets,
    });
  } catch (error) {
    console.error("getAllAssets error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assets",
      error: error.message,
    });
  }
};

/**
 * 3. Get Asset by ID
 * GET /api/assets/:id
 */
export const getAssetById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = normalizeRole(req.user?.role);
    const query = { _id: id };

    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    const asset = await Asset.findOne(query).populate({
      path: "current_assignment",
      populate: {
        path: "employee_id",
        populate: { path: "user_id department_id" },
      },
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    return res.status(200).json({
      success: true,
      asset,
    });
  } catch (error) {
    console.error("getAssetById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch asset",
      error: error.message,
    });
  }
};

/**
 * 4. Update Asset
 * PUT /api/assets/:id
 */
export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      brand,
      model,
      serial_number,
      purchase_date,
      status,
      condition,
      notes,
    } = req.body;

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    if (type) asset.type = type;
    if (brand) asset.brand = brand.trim();
    if (model) asset.model = model.trim();
    if (serial_number !== undefined) asset.serial_number = serial_number.trim();
    if (purchase_date !== undefined)
      asset.purchase_date = purchase_date ? new Date(purchase_date) : null;
    if (status) asset.status = status;
    if (condition) asset.condition = condition;
    if (notes !== undefined) asset.notes = notes;

    await asset.save();

    return res.status(200).json({
      success: true,
      message: "Asset updated successfully.",
      asset,
    });
  } catch (error) {
    console.error("updateAsset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update asset",
      error: error.message,
    });
  }
};

/**
 * 5. Delete Asset
 * DELETE /api/assets/:id
 */
export const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findById(id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    if (asset.status === "Assigned") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete an asset that is currently assigned to an employee. Return it first.",
      });
    }

    await Asset.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Asset deleted successfully.",
    });
  } catch (error) {
    console.error("deleteAsset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete asset",
      error: error.message,
    });
  }
};

/**
 * 6. Assign Asset to Employee
 * POST /api/assets/assign
 */
export const assignAsset = async (req, res) => {
  try {
    const { asset_id, employee_id, notes } = req.body;
    const userId = req.user?.id || req.user?._id;

    // Check asset
    const asset = await Asset.findById(asset_id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found.",
      });
    }

    // REQUIREMENT: Blocks if asset not Available
    if (asset.status !== "Available") {
      return res.status(400).json({
        success: false,
        message: `Asset is not available for assignment. Current status: ${asset.status}`,
      });
    }

    // Check employee
    const employee = await Employee.findById(employee_id).populate("user_id");
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    if (employee.employment_status === "Inactive") {
      return res.status(400).json({
        success: false,
        message: "Cannot assign assets to an inactive/relieved employee.",
      });
    }

    // Create assignment
    const assignment = await AssetAssignment.create({
      asset_id,
      employee_id,
      assigned_date: new Date(),
      assigned_by: userId,
      notes: notes || "",
      status: "Active",
      organizationId: req.user?.organizationId || null,
    });

    // Update asset
    asset.status = "Assigned";
    asset.current_assignment = assignment._id;
    await asset.save();

    // Notify employee
    if (employee.user_id) {
      const recipientId = employee.user_id._id || employee.user_id;
      await createNotification({
        recipient: recipientId,
        type: "asset_assigned",
        message: `A new company asset has been assigned to you: ${asset.brand} ${asset.model} (${asset.asset_tag}).`,
        link: "/employee/profile",
      });
    }

    const populatedAssignment = await AssetAssignment.findById(assignment._id)
      .populate("asset_id")
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id" },
      });

    return res.status(201).json({
      success: true,
      message: "Asset assigned successfully.",
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error("assignAsset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign asset",
      error: error.message,
    });
  }
};

/**
 * 7. Return Asset
 * POST /api/assets/return
 */
export const returnAsset = async (req, res) => {
  try {
    const { assignment_id, asset_id, return_condition, notes } = req.body;

    let assignment;
    if (assignment_id) {
      assignment = await AssetAssignment.findById(assignment_id).populate("asset_id employee_id");
    } else if (asset_id) {
      assignment = await AssetAssignment.findOne({
        asset_id,
        status: "Active",
      }).populate("asset_id employee_id");
    }

    if (!assignment || assignment.status !== "Active") {
      return res.status(404).json({
        success: false,
        message: "No active assignment found for this asset.",
      });
    }

    // Close assignment
    assignment.status = "Returned";
    assignment.returned_date = new Date();
    if (return_condition) assignment.return_condition = return_condition;
    if (notes) assignment.notes = assignment.notes ? `${assignment.notes} | Return note: ${notes}` : notes;
    await assignment.save();

    // Set Asset back to Available
    const asset = await Asset.findById(assignment.asset_id._id || assignment.asset_id);
    if (asset) {
      asset.status = "Available";
      asset.current_assignment = null;
      if (return_condition) {
        asset.condition = return_condition;
      }
      await asset.save();
    }

    // Notify employee of return
    const employee = await Employee.findById(assignment.employee_id).populate("user_id");
    if (employee?.user_id) {
      const recipientId = employee.user_id._id || employee.user_id;
      await createNotification({
        recipient: recipientId,
        type: "asset_returned",
        message: `Asset return recorded: ${asset?.brand} ${asset?.model} (${asset?.asset_tag}) has been returned.`,
        link: "/employee/profile",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Asset returned successfully. Status reset to Available.",
      assignment,
      asset,
    });
  } catch (error) {
    console.error("returnAsset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to return asset",
      error: error.message,
    });
  }
};

/**
 * 8. Get Asset History by Employee
 * GET /api/assets/employee/:employeeId
 */
export const getEmployeeAssets = async (req, res) => {
  try {
    let { employeeId } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);

    if (employeeId === "me") {
      const emp = await Employee.findOne({ user_id: userId });
      if (!emp) {
        return res.status(404).json({
          success: false,
          message: "Employee profile not found",
        });
      }
      employeeId = emp._id;
    }

    // RBAC check
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const isOwner =
      employee.user_id && String(employee.user_id) === String(userId);
    const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

    if (!isStaff && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this employee's asset records",
      });
    }

    const assignments = await AssetAssignment.find({ employee_id: employeeId })
      .populate("asset_id")
      .populate("assigned_by", "name email")
      .sort({ assigned_date: -1 });

    const activeAssets = assignments.filter((a) => a.status === "Active");
    const returnedAssets = assignments.filter((a) => a.status === "Returned");

    return res.status(200).json({
      success: true,
      count: assignments.length,
      activeAssets,
      returnedAssets,
      assignments,
    });
  } catch (error) {
    console.error("getEmployeeAssets error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee assets",
      error: error.message,
    });
  }
};

/**
 * 9. Get Assignment History by Asset ID
 * GET /api/assets/:id/history
 */
export const getAssetHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await AssetAssignment.find({ asset_id: id })
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id" },
      })
      .populate("assigned_by", "name email")
      .sort({ assigned_date: -1 });

    return res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    console.error("getAssetHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch asset history",
      error: error.message,
    });
  }
};

/**
 * 10. List All Assignments
 * GET /api/assets/assignments/all
 */
export const getAllAssignments = async (req, res) => {
  try {
    const { status } = req.query;
    const userRole = normalizeRole(req.user?.role);
    const query = {};

    if (userRole !== "super_admin" && req.user?.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    if (status && status !== "ALL") query.status = status;

    const assignments = await AssetAssignment.find(query)
      .populate("asset_id")
      .populate({
        path: "employee_id",
        populate: { path: "user_id department_id" },
      })
      .populate("assigned_by", "name email")
      .sort({ assigned_date: -1 });

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("getAllAssignments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch asset assignments",
      error: error.message,
    });
  }
};
