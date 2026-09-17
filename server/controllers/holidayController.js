import Holiday from "../models/Holiday.js";
import { normalizeRole } from "../middlewares/authMiddleware.js";

/**
 * 1. Create Holiday
 * POST /api/holidays
 */
export const createHoliday = async (req, res) => {
  try {
    const { name, date, type, description, organizationId: bodyOrgId } = req.body;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);
    const organizationId =
      userRole === "super_admin"
        ? (bodyOrgId || null)
        : (req.user?.organizationId || null);

    const parsedDate = new Date(date);
    const year = parsedDate.getFullYear();

    const holiday = await Holiday.create({
      name: name.trim(),
      date: parsedDate,
      year,
      type: type || "National",
      description: description || "",
      organizationId,
      created_by: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Holiday created successfully.",
      holiday,
    });
  } catch (error) {
    console.error("createHoliday error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A holiday with this name and date already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create holiday",
      error: error.message,
    });
  }
};

/**
 * 2. Get All Holidays
 * GET /api/holidays
 * Accessible to all authenticated roles
 */
export const getAllHolidays = async (req, res) => {
  try {
    const { year, month, type, search, organizationId: queryOrgId } = req.query;
    const userRole = normalizeRole(req.user?.role);
    const query = {};

    // Multi-tenant filter
    if (userRole === "super_admin") {
      if (queryOrgId && queryOrgId !== "all") {
        query.organizationId = queryOrgId;
      }
    } else if (req.user?.organizationId) {
      query.$or = [
        { organizationId: req.user.organizationId },
        { organizationId: null }, // global holidays
      ];
    }

    if (year) {
      query.year = parseInt(year, 10);
    }

    if (type && type !== "ALL") {
      query.type = type;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    let holidays = await Holiday.find(query)
      .populate("organizationId", "name orgCode")
      .sort({ date: 1 });

    if (month !== undefined && month !== null && month !== "") {
      const m = parseInt(month, 10);
      holidays = holidays.filter((h) => new Date(h.date).getMonth() === m);
    }

    return res.status(200).json({
      success: true,
      count: holidays.length,
      holidays,
    });
  } catch (error) {
    console.error("getAllHolidays error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch holidays",
      error: error.message,
    });
  }
};

/**
 * 3. Get Holiday by ID
 * GET /api/holidays/:id
 */
export const getHolidayById = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findById(id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    return res.status(200).json({
      success: true,
      holiday,
    });
  } catch (error) {
    console.error("getHolidayById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch holiday",
      error: error.message,
    });
  }
};

/**
 * 4. Update Holiday
 * PUT /api/holidays/:id
 */
export const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, type, description } = req.body;

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    if (name) holiday.name = name.trim();
    if (date) {
      holiday.date = new Date(date);
      holiday.year = holiday.date.getFullYear();
    }
    if (type) holiday.type = type;
    if (description !== undefined) holiday.description = description;

    await holiday.save();

    return res.status(200).json({
      success: true,
      message: "Holiday updated successfully.",
      holiday,
    });
  } catch (error) {
    console.error("updateHoliday error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update holiday",
      error: error.message,
    });
  }
};

/**
 * 5. Delete Holiday
 * DELETE /api/holidays/:id
 */
export const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findByIdAndDelete(id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Holiday deleted successfully.",
    });
  } catch (error) {
    console.error("deleteHoliday error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete holiday",
      error: error.message,
    });
  }
};

/**
 * 6. Bulk Import Holidays
 * POST /api/holidays/bulk
 */
export const bulkImportHolidays = async (req, res) => {
  try {
    const { holidays, organizationId: bodyOrgId } = req.body;
    const userId = req.user?.id || req.user?._id;
    const userRole = normalizeRole(req.user?.role);
    const organizationId =
      userRole === "super_admin"
        ? (bodyOrgId || null)
        : (req.user?.organizationId || null);

    let importedCount = 0;
    let skippedCount = 0;

    for (const item of holidays) {
      try {
        const d = new Date(item.date);
        await Holiday.create({
          name: item.name.trim(),
          date: d,
          year: d.getFullYear(),
          type: item.type || "National",
          description: item.description || "",
          organizationId,
          created_by: userId,
        });
        importedCount++;
      } catch (err) {
        skippedCount++;
      }
    }

    return res.status(201).json({
      success: true,
      message: `Bulk import completed: ${importedCount} added, ${skippedCount} skipped/duplicates.`,
      importedCount,
      skippedCount,
    });
  } catch (error) {
    console.error("bulkImportHolidays error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bulk import holidays",
      error: error.message,
    });
  }
};
